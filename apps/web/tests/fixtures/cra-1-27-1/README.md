# CRA XML schema package 1-27-1 (test fixture)

- File: `xmlschm1-27-1.zip` — CRA's official schema package for the
  2027 filing season (filing 2026 slips in Jan–Mar 2027; see spec §2 in
  `~/workspace/nexvar-pay-versatility/specs/cra-t4-xml.md`).
  **Not committed to git** (the package is binary; this repo's push flow is
  UTF-8 text only). Download it into this directory to enable the real XSD
  validation locally — without it, `tests/t4-xml-xsd.test.ts` falls back to
  the spec's structural rules and logs that the XSD step was not run.
- Downloaded: 2026-11-02 from CRA's "Get ready to file information returns
  electronically" page:
  https://www.canada.ca/content/dam/cra-arc/serv-info/eservices/xmlschm1-27-1.zip
  (linked from https://www.canada.ca/en/revenue-agency/services/e-services/filing-information-returns-electronically-t4-t5-other-types-returns-overview/xml-specs.html)
- SHA-256: `304b4379d06f2989120aa088b19b61b3b10ecbad1770c4cab50aa285038d6801`
- Contents used by the tests: `SchemasEFV-Published - 2027/T619_T4.xsd`
  ( Submission root, includes simple.xsd / complex.xsd, which include
  t4.xsd ) — the whole package is kept intact because the XSD include
  closure spans most of it.
- Used by: `tests/t4-xml-xsd.test.ts` (local validation only; CRA offers no
  test environment — spec §7). Per spec §7 the package is versioned per
  filing season; add next season's package as a sibling directory rather
  than overwriting this one.
