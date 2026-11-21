/**
 * XSD validation of generated T4A XML against CRA's official schema
 * package xmlschm1-27-1. Mirrors tests/t4-xml-xsd.test.ts: validation
 * runs through python3 + lxml when the fixture package is present; if
 * NO XSD validator is available, the test falls back to structural
 * assertions and logs that the XSD step was NOT run — it must not be
 * reported as passed.
 *
 * Fixture: tests/fixtures/cra-1-27-1/xmlschm1-27-1.zip (see the README
 * in that directory for provenance; the package is not committed).
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  computeT4aSlip,
  computeT4aSummary,
  type T4aPayeeYearData,
} from "../src/lib/filings/t4a-boxes";
import { buildT4aXml, type T4aSubmissionInput } from "../src/lib/filings/t4a-xml";

const XSD_ZIP = path.resolve(__dirname, "fixtures/cra-1-27-1/xmlschm1-27-1.zip");

// ─── Sample submission (contractor + business + pensioner) ───────────────────

function sampleXml(): string {
  const contractor: T4aPayeeYearData = {
    payeeType: "INDIVIDUAL",
    surname: "Nguyen",
    givenName: "Linh",
    sin: "123456789",
    addressLine1: "88 Pine Cres",
    city: "Edmonton",
    province: "AB",
    postalCode: "T6H2K4",
    payments: [
      { boxCode: "048", amount: 15000, incomeTaxDeducted: 500 },
      { boxCode: "028", amount: 250 },
      { boxCode: "046", amount: 100 },
    ],
  };
  const business: T4aPayeeYearData = {
    payeeType: "BUSINESS",
    businessName: "Prairie Peak Renovations Ltd.",
    recipientBn: "123456789RT0001",
    addressLine1: "12 Industrial Rd",
    city: "Calgary",
    province: "AB",
    postalCode: "T2P0A0",
    payments: [{ boxCode: "048", amount: 42000 }],
  };
  const pensioner: T4aPayeeYearData = {
    payeeType: "INDIVIDUAL",
    surname: "Okafor",
    givenName: "Adaeze",
    sin: "987654321",
    recipientBn: "123456789RC0001",
    dentalBenefitsCode: 3,
    rppRegistrationNumber: "1234567",
    payments: [
      { boxCode: "016", amount: 2400 },
      { boxCode: "018", amount: 5000, incomeTaxDeducted: 1000 },
      { boxCode: "034", amount: 900 },
    ],
  };
  const slips = [computeT4aSlip(contractor), computeT4aSlip(business), computeT4aSlip(pensioner)];
  const input: T4aSubmissionInput = {
    transmitter: {
      accountNumber15: "123456789RP0001",
      submissionRefId: "XsdTestA",
      language: "E",
      name1: "Nexvar Lab Inc",
      countryCode: "CAN",
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234", ext: "9", email: "jane@example.com" },
    },
    payer: {
      bn15: "123456789RP0001",
      name1: "Acme & Sons Inc",
      address: { line1: "1 Corp Way", city: "Calgary", province: "AB", countryCode: "CAN", postalCode: "T2P0A0" },
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234" },
      rppRegistrationNumbers: ["1234567"],
      proprietorSin1: "123456789",
    },
    taxYear: 2026,
    slips,
    summary: computeT4aSummary(slips),
  };
  return buildT4aXml(input);
}

// ─── Validator plumbing ──────────────────────────────────────────────────────

const PYTHON_VALIDATE = `
import sys, zipfile, tempfile, os
from lxml import etree
zip_path, xml_path = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp(prefix="cra-xsd-")
with zipfile.ZipFile(zip_path) as z:
    z.extractall(tmp)
schema_path = None
for root, _dirs, files in os.walk(tmp):
    if "T619_T4A.xsd" in files:
        schema_path = os.path.join(root, "T619_T4A.xsd")
        break
if schema_path is None:
    print("T619_T4A.xsd not found in schema package")
    sys.exit(2)
schema = etree.XMLSchema(etree.parse(schema_path))
doc = etree.parse(xml_path)
if schema.validate(doc):
    print("XSD VALID")
else:
    for e in schema.error_log:
        print("XSD ERROR:", e)
    sys.exit(1)
`;

function pythonLxmlAvailable(): boolean {
  try {
    execFileSync("python3", ["-c", "import lxml.etree"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/** Returns validator output on success; throws (with output) on failure. */
function validateWithPythonLxml(xml: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "t4a-xsd-test-"));
  const xmlPath = path.join(dir, "submission.xml");
  writeFileSync(xmlPath, xml, "utf8");
  return execFileSync("python3", ["-c", PYTHON_VALIDATE, XSD_ZIP, xmlPath], {
    encoding: "utf8",
    stdio: "pipe",
  });
}

const XSD_AVAILABLE = existsSync(XSD_ZIP) && pythonLxmlAvailable();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("T4A XML vs CRA schema package xmlschm1-27-1", () => {
  it(
    "generated submission validates against T619_T4A.xsd / t4a.xsd",
    () => {
      const xml = sampleXml();
      if (!XSD_AVAILABLE) {
        console.warn(
          "[t4a-xml-xsd] XSD VALIDATION NOT RUN: python3+lxml unavailable or fixture zip missing. " +
            "Falling back to structural assertions only.",
        );
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(xml.match(/<T619>/g)).toHaveLength(1);
        expect(xml.match(/<T4ASummary>/g)).toHaveLength(1);
        expect(xml).toContain("<summ_cnt>1</summ_cnt>");
        expect(xml).not.toMatch(/<([A-Za-z_][\w.-]*)><\/\1>/);
        return;
      }
      const out = validateWithPythonLxml(xml);
      expect(out).toContain("XSD VALID");
    },
    60_000,
  );

  it(
    "validator actually rejects a mutated (schema-invalid) submission",
    () => {
      if (!XSD_AVAILABLE) {
        console.warn("[t4a-xml-xsd] XSD negative test skipped: no validator available.");
        return;
      }
      // tx_yr must match the yearType pattern (e.g. 2026); "YEAR" cannot validate.
      const bad = sampleXml().replace("<tx_yr>2026</tx_yr>", "<tx_yr>YEAR</tx_yr>");
      expect(bad).not.toContain("<tx_yr>2026</tx_yr>");
      expect(() => validateWithPythonLxml(bad)).toThrow();
    },
    60_000,
  );
});
