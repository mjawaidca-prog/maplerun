/**
 * POST /api/integrations/ledgerpro/test — "Test connection" for the
 * LedgerPro integration (M6). Calls GET /api/v1/accounts with the
 * submitted (or stored) key, then pre-flights the mapped payroll codes.
 *
 * Auth/membership pattern follows /api/pay-groups: session + membership
 * check against the companyId in the body.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { createLedgerProClient } from "@/lib/ledgerpro";
import { normalizeMapping, type MappingMode } from "@/lib/ledgerpro-journal";
import { testConnection } from "@/lib/ledgerpro-sync";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    companyId?: string;
    baseUrl?: string;
    apiKey?: string;
    mappingMode?: string;
    mapping?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyId } = body;
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, companyId },
  });
  if (!membership) {
    return NextResponse.json({ error: "You do not belong to this company" }, { status: 403 });
  }

  const stored = await prisma.ledgerProConnection.findUnique({ where: { companyId } });

  const baseUrl = (body.baseUrl ?? stored?.baseUrl ?? "").trim().replace(/\/+$/, "");
  let apiKey = (body.apiKey ?? "").trim();
  if (!apiKey && stored) {
    try {
      apiKey = decrypt(stored.apiKeyEncrypted);
    } catch {
      return NextResponse.json({ ok: false, message: "The stored API key could not be decrypted. Paste the key again and Save." });
    }
  }
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ ok: false, message: "Enter the LedgerPro base URL and API key first." });
  }

  const mappingMode: MappingMode =
    body.mappingMode === "MODE2" || body.mappingMode === "MODE1"
      ? body.mappingMode
      : stored?.mappingMode === "MODE2"
        ? "MODE2"
        : "MODE1";
  const mapping = normalizeMapping(body.mapping ?? stored?.mapping);

  const result = await testConnection(
    { createClient: (conn) => createLedgerProClient(conn) },
    { baseUrl, apiKey, mappingMode, mapping },
  );

  return NextResponse.json(result);
}
