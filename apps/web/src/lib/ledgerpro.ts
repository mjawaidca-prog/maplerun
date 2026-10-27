/**
 * LedgerPro API client — Nexvar Pay's first outbound HTTP wrapper (M2).
 *
 * Talks to LedgerPro's Developer API (one API key = one company):
 *   GET  /api/v1/accounts                              (pre-flight, `read`)
 *   POST /api/v1/journal-entries                       (`write_posting`, Idempotency-Key mandatory)
 *   POST /api/v1/journal-entries/[id]/void             (Idempotency-Key mandatory)
 *
 * Design notes:
 * - `fetch` is injectable so tests can mock the HTTP layer without a server.
 * - Every failure is returned as a typed `LedgerProError` result — callers
 *   never see a raw throw from the network layer.
 * - LedgerPro error semantics that matter to the sync (see scoping doc):
 *   failures ≥400 do NOT burn the idempotency key; a 409 with a plain body
 *   is a closed period; `409 idempotency_key_conflict` means the same key
 *   was reused with a different payload (hard error, never auto-rekey).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerProErrorKind =
  | "auth" // 401 — bad / revoked key
  | "plan" // 403 api_plan_required | api_access_disabled
  | "closed_period" // 409 plain body — entry date (or today, for voids) is in a closed period
  | "idempotency_conflict" // 409 idempotency_key_conflict — same key, different payload
  | "validation" // 400 validation_error | invalid_account | journal_unbalanced | …
  | "not_found" // 404
  | "network" // fetch threw / timed out
  | "http"; // any other non-2xx

export class LedgerProError extends Error {
  readonly kind: LedgerProErrorKind;
  /** LedgerPro's machine-readable error code, when it sent one. */
  readonly code: string | null;
  readonly status: number | null;

  constructor(opts: {
    kind: LedgerProErrorKind;
    message: string;
    code?: string | null;
    status?: number | null;
  }) {
    super(opts.message);
    this.name = "LedgerProError";
    this.kind = opts.kind;
    this.code = opts.code ?? null;
    this.status = opts.status ?? null;
  }
}

export type LedgerProResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: LedgerProError };

export interface LedgerProAccount {
  code: string;
  name?: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface JournalLine {
  glAccountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface CreateJournalPayload {
  entryDate: string; // YYYY-MM-DD
  description: string; // ≤500 chars
  lines: JournalLine[];
}

export interface CreatedJournal {
  id: string;
  entryDate: string;
  description: string;
  sourceType: string;
}

export interface LedgerProClient {
  listAccounts(): Promise<LedgerProResult<LedgerProAccount[]>>;
  createJournalEntry(
    payload: CreateJournalPayload,
    idempotencyKey: string,
  ): Promise<LedgerProResult<CreatedJournal>>;
  voidJournalEntry(
    entryId: string,
    idempotencyKey: string,
  ): Promise<LedgerProResult<{ id: string }>>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface LedgerProClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchFn?: FetchLike;
  /** Per-request timeout in ms (default 15s). */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Pull LedgerPro's error code out of a response body, tolerating plain-text bodies (closed-period 409). */
function extractErrorCode(bodyText: string): { code: string | null; message: string | null } {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    const err = (parsed.error ?? parsed) as Record<string, unknown>;
    const code =
      typeof err.code === "string" ? err.code : typeof parsed.code === "string" ? parsed.code : null;
    const message =
      typeof err.message === "string"
        ? err.message
        : typeof parsed.message === "string"
          ? parsed.message
          : null;
    return { code, message };
  } catch {
    return { code: null, message: null };
  }
}

function toLedgerProError(status: number, bodyText: string): LedgerProError {
  const { code, message } = extractErrorCode(bodyText);
  const fallback = `LedgerPro request failed (HTTP ${status}).`;

  if (status === 401) {
    return new LedgerProError({ kind: "auth", status, code, message: message ?? "LedgerPro rejected the API key (401). Check the key in Integrations." });
  }
  if (status === 403 || code === "api_plan_required" || code === "api_access_disabled") {
    return new LedgerProError({ kind: "plan", status, code, message: message ?? "LedgerPro API access isn't enabled for this company (plan or API switch)." });
  }
  if (status === 409 && code === "idempotency_key_conflict") {
    return new LedgerProError({ kind: "idempotency_conflict", status, code, message: message ?? "This pay run was already posted to LedgerPro with different figures. Do not retry — flag it for review." });
  }
  if (status === 409) {
    // Plain-body 409 on the v1 journal path = PeriodClose guard.
    return new LedgerProError({ kind: "closed_period", status, code, message: message ?? (bodyText.trim() || "The journal date is in a closed period in LedgerPro.") });
  }
  if (status === 404) {
    return new LedgerProError({ kind: "not_found", status, code, message: message ?? "LedgerPro resource not found (404)." });
  }
  if (status === 400) {
    return new LedgerProError({ kind: "validation", status, code, message: message ?? fallback });
  }
  return new LedgerProError({ kind: "http", status, code, message: message ?? fallback });
}

export function createLedgerProClient(opts: LedgerProClientOptions): LedgerProClient {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const fetchFn: FetchLike = opts.fetchFn ?? ((input, init) => fetch(input, init));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    path: string,
    init: RequestInit,
    parse: (json: unknown) => T,
  ): Promise<LedgerProResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchFn(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        error: new LedgerProError({
          kind: "network",
          status: null,
          message: timedOut
            ? `LedgerPro did not respond within ${Math.round(timeoutMs / 1000)}s.`
            : `Could not reach LedgerPro: ${err instanceof Error ? err.message : String(err)}`,
        }),
      };
    } finally {
      clearTimeout(timer);
    }

    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, error: toLedgerProError(res.status, bodyText) };
    }
    try {
      const json: unknown = bodyText ? JSON.parse(bodyText) : {};
      return { ok: true, data: parse(json) };
    } catch {
      return {
        ok: false,
        error: new LedgerProError({
          kind: "http",
          status: res.status,
          message: "LedgerPro returned an unreadable response.",
        }),
      };
    }
  }

  /** LedgerPro wraps payloads as { data: … }; tolerate a bare payload too. */
  function unwrap(json: unknown): unknown {
    if (json && typeof json === "object" && "data" in (json as Record<string, unknown>)) {
      return (json as Record<string, unknown>).data;
    }
    return json;
  }

  // ─── GET /accounts pagination ─────────────────────────────────────────────
  // LedgerPro's list endpoints are cursor-paginated: default page size 50
  // (max 100), ordered by code asc, envelope
  //   { data: […], pagination: { nextCursor, hasMore } }
  // with the next page at ?cursor=<nextCursor>. A company can hold more
  // accounts than one page (Muja has 52 — its two highest mapped codes,
  // 6920/6940, sort onto page 2), so listAccounts MUST walk every page or
  // the pre-flight falsely reports mapped accounts as missing.
  const ACCOUNTS_PAGE_LIMIT = 100;
  /** Hard stop so a misbehaving server can never loop us forever. */
  const MAX_ACCOUNT_PAGES = 100;

  interface AccountsPage {
    accounts: LedgerProAccount[];
    /** Raw pagination block, or null when the response carried none. */
    pagination: { nextCursor: unknown; hasMore: unknown } | null;
  }

  function parseAccountsPage(json: unknown): AccountsPage {
    const data = unwrap(json);
    const accounts = (Array.isArray(data) ? data : []) as LedgerProAccount[];
    let pagination: AccountsPage["pagination"] = null;
    if (json && typeof json === "object" && "pagination" in (json as Record<string, unknown>)) {
      const raw = (json as Record<string, unknown>).pagination;
      if (raw && typeof raw === "object") {
        const rec = raw as Record<string, unknown>;
        pagination = { nextCursor: rec.nextCursor, hasMore: rec.hasMore };
      } else {
        // Present but not an object — malformed; surfaced by listAccounts.
        pagination = { nextCursor: undefined, hasMore: undefined };
      }
    }
    return { accounts, pagination };
  }

  function paginationError(message: string): LedgerProResult<LedgerProAccount[]> {
    return { ok: false, error: new LedgerProError({ kind: "http", status: null, message }) };
  }

  /**
   * Fetch EVERY account, following cursors until `hasMore` is false.
   * Any failure — an HTTP error mid-walk, malformed pagination metadata, a
   * repeated cursor, or a runaway page count — returns the typed error and
   * NO partial list: a truncated chart would make the pre-flight (and Test
   * Connection) report mapped accounts as missing when they exist.
   */
  async function listAllAccounts(): Promise<LedgerProResult<LedgerProAccount[]>> {
    const all: LedgerProAccount[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;

    for (let page = 0; page < MAX_ACCOUNT_PAGES; page++) {
      const path: string = cursor
        ? `/api/v1/accounts?limit=${ACCOUNTS_PAGE_LIMIT}&cursor=${encodeURIComponent(cursor)}`
        : `/api/v1/accounts?limit=${ACCOUNTS_PAGE_LIMIT}`;
      const res: LedgerProResult<AccountsPage> = await request(path, { method: "GET" }, parseAccountsPage);
      if (!res.ok) return res;

      all.push(...res.data.accounts);
      const pagination: AccountsPage["pagination"] = res.data.pagination;
      // No pagination envelope — a single-page response (older shape).
      if (pagination === null) return { ok: true, data: all };
      if (typeof pagination.hasMore !== "boolean") {
        return paginationError("LedgerPro returned malformed pagination for the account list — aborting instead of trusting a partial chart.");
      }
      if (!pagination.hasMore) return { ok: true, data: all };

      const next: unknown = pagination.nextCursor;
      if (typeof next !== "string" || next.length === 0) {
        return paginationError("LedgerPro said more accounts exist but sent no usable cursor — aborting instead of trusting a partial chart.");
      }
      if (seenCursors.has(next)) {
        return paginationError("LedgerPro repeated a pagination cursor for the account list — aborting instead of looping.");
      }
      seenCursors.add(next);
      cursor = next;
    }
    return paginationError(`LedgerPro's account list did not finish after ${MAX_ACCOUNT_PAGES} pages — aborting instead of trusting a partial chart.`);
  }

  return {
    listAccounts: listAllAccounts,

    createJournalEntry(payload, idempotencyKey) {
      return request(
        "/api/v1/journal-entries",
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        },
        (json) => unwrap(json) as CreatedJournal,
      );
    },

    voidJournalEntry(entryId, idempotencyKey) {
      return request(
        `/api/v1/journal-entries/${encodeURIComponent(entryId)}/void`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({}),
        },
        (json) => {
          const data = unwrap(json) as { id?: string } | null;
          return { id: data?.id ?? entryId };
        },
      );
    },
  };
}

/** Plain-language message for a sync failure, per the scoping doc §3.5. */
export function describeLedgerProError(error: LedgerProError): string {
  switch (error.kind) {
    case "plan":
      return "LedgerPro API access isn't enabled for this company — it needs a Pro/Enterprise plan with API access switched on in LedgerPro Settings → Developer.";
    case "auth":
      return "LedgerPro rejected the API key. Re-paste the key in Company → Integrations.";
    case "closed_period":
      return error.message;
    case "idempotency_conflict":
      return "This pay run was already posted to LedgerPro with different figures (idempotency conflict). Do not retry — flag it for review.";
    case "validation":
      if (error.code === "invalid_account") return error.message;
      if (error.code === "journal_unbalanced") return "Internal rounding mismatch — do not retry, flag it.";
      return error.message;
    case "network":
      return error.message;
    default:
      return error.message;
  }
}
