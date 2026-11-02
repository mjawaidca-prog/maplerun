/**
 * XSD validation of generated T4 XML against CRA's official schema package
 * xmlschm1-27-1 (spec §7: CRA provides no test environment — validate
 * locally against the XSDs).
 *
 * The package is vendored as a test fixture (see
 * tests/fixtures/cra-1-27-1/README.md for provenance). Validation runs
 * through python3 + lxml when available (xmllint is not installed in this
 * environment; libxml2 underlies both). If NO XSD validator is available,
 * the test falls back to the spec's structural rules and logs a warning —
 * the XSD step is then NOT RUN and must not be reported as passed.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  computeT4Slip,
  computeT4Summary,
  type T4EmployeeYearData,
} from "../src/lib/filings/t4-boxes";
import { buildT4Xml, type T4SubmissionInput } from "../src/lib/filings/t4-xml";

const XSD_ZIP = path.resolve(__dirname, "fixtures/cra-1-27-1/xmlschm1-27-1.zip");

// ─── Sample submission (one AB slip + one QC slip) ───────────────────────────

function sampleXml(): string {
  const ab: T4EmployeeYearData = {
    surname: "Smith",
    givenName: "John",
    initial: "A",
    sin: "123456789",
    addressLine1: "123 Main St",
    city: "Calgary",
    provinceOfResidence: "AB",
    postalCode: "T2X1V4",
    provinceOfEmployment: "AB",
    dentalBenefitsCode: 3,
    employmentIncome: 90000,
    cpp: 3867.5,
    cpp2: 188.2,
    ei: 1049.12,
    rppContributions: 3000,
    unionDues: 250.5,
    pensionAdjustment: 5000,
    federalTax: 12000,
    provincialTax: 6000,
    eiInsurableEarnings: 65700,
    cppPensionableEarnings: 71300,
    employerCpp: 3867.5,
    employerCpp2: 188.2,
    employerEi: 1468.77,
    otherInfo: [{ code: 40, amount: 1200 }],
  };
  const qc: T4EmployeeYearData = {
    surname: "Tremblay",
    givenName: "Marie",
    sin: "987654321",
    addressLine1: "456 Rue Sainte-Catherine",
    city: "Montréal",
    provinceOfResidence: "QC",
    postalCode: "H2X1Y6",
    provinceOfEmployment: "QC",
    employmentIncome: 75000,
    qpp: 4100.25,
    qpp2: 200.1,
    ei: 950.3,
    qpipPremiums: 315.4,
    qpipInsurableEarnings: 98000,
    federalTax: 11000,
    provincialTax: 9500,
    eiInsurableEarnings: 65700,
    cppPensionableEarnings: 71300,
    employerEi: 1330.42,
  };
  const slips = [computeT4Slip(ab), computeT4Slip(qc)];
  const input: T4SubmissionInput = {
    transmitter: {
      accountNumber15: "123456789RP0001",
      submissionRefId: "XsdTestA",
      language: "E",
      name1: "Nexvar Lab Inc",
      countryCode: "CAN",
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234", ext: "9", email: "jane@example.com" },
    },
    employer: {
      bn15: "123456789RP0001",
      name1: "Acme & Sons Inc",
      address: { line1: "1 Corp Way", city: "Calgary", province: "AB", countryCode: "CAN", postalCode: "T2P0A0" },
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234" },
    },
    taxYear: 2026,
    slips,
    summary: computeT4Summary(slips),
  };
  return buildT4Xml(input);
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
    if "T619_T4.xsd" in files:
        schema_path = os.path.join(root, "T619_T4.xsd")
        break
if schema_path is None:
    print("T619_T4.xsd not found in schema package")
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
  const dir = mkdtempSync(path.join(tmpdir(), "t4-xsd-test-"));
  const xmlPath = path.join(dir, "submission.xml");
  writeFileSync(xmlPath, xml, "utf8");
  return execFileSync("python3", ["-c", PYTHON_VALIDATE, XSD_ZIP, xmlPath], {
    encoding: "utf8",
    stdio: "pipe",
  });
}

const XSD_AVAILABLE = existsSync(XSD_ZIP) && pythonLxmlAvailable();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("T4 XML vs CRA schema package xmlschm1-27-1", () => {
  it(
    "generated submission validates against T619_T4.xsd / t4.xsd",
    () => {
      const xml = sampleXml();
      if (!XSD_AVAILABLE) {
        // No XSD validator runnable in this environment (no python3+lxml /
        // xmllint, or the fixture package is missing). Fall back to the
        // spec's structural rules (§3) and say so — this is NOT an XSD pass.
        console.warn(
          "[t4-xml-xsd] XSD VALIDATION NOT RUN: python3+lxml unavailable or fixture zip missing. " +
            "Falling back to structural assertions only.",
        );
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(xml.match(/<T619>/g)).toHaveLength(1);
        expect(xml.match(/<T4Summary>/g)).toHaveLength(1);
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
        console.warn("[t4-xml-xsd] XSD negative test skipped: no validator available.");
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
