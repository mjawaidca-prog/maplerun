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

  return {
    listAccounts() {
      return request("/api/v1/accounts", { method: "GET" }, (json) => {
        const data = unwrap(json);
        return (Array.isArray(data) ? data : []) as LedgerProAccount[];
      });
    },

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
