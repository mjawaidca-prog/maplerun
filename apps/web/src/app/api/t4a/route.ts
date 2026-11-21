import { NextResponse } from "next/server";
import { generateT4aXmlFile, type T4aFilingDetails } from "@/lib/actions/t4a";

/**
 * GET /api/t4a/xml?year=2026&payerBn15=…&contactName=…&…
 *
 * Downloads the CRA T4A XML submission for the year. Filing details the
 * company record does not hold (payer RP account, contact, payer address)
 * arrive as query parameters from the export form on /reports/t4a —
 * nothing is fabricated: every field CRA requires is required here.
 * Mirrors the /api/eft download route.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : NaN;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year required (e.g. ?year=2026)" }, { status: 400 });
  }

  const required = ["payerBn15", "contactName", "contactAreaCode", "contactPhone", "contactEmail"] as const;
  const missing = required.filter((k) => !(searchParams.get(k) ?? "").trim());
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required filing details: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const get = (k: string) => {
    const v = (searchParams.get(k) ?? "").trim();
    return v === "" ? undefined : v;
  };

  const filing: T4aFilingDetails = {
    payerBn15: get("payerBn15")!,
    payerName2: get("payerName2"),
    payerName3: get("payerName3"),
    payerAddressLine1: get("payerAddressLine1"),
    payerAddressLine2: get("payerAddressLine2"),
    payerCity: get("payerCity"),
    payerProvince: get("payerProvince"),
    payerPostalCode: get("payerPostalCode"),
    contactName: get("contactName")!,
    contactAreaCode: get("contactAreaCode")!,
    contactPhone: get("contactPhone")!,
    contactExt: get("contactExt"),
    contactEmail: get("contactEmail")!,
    transmitterName: get("transmitterName"),
    transmitterAccountNumber15: get("transmitterAccountNumber15"),
    language: get("language") === "F" ? "F" : "E",
  };

  try {
    const { filename, content } = await generateT4aXmlFile(year, filing);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate T4A XML" },
      { status: 500 },
    );
  }
}
