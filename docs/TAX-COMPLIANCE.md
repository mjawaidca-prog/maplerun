# Tax Compliance: Sources, Status, Protocol

## Authoritative sources (in priority order)
1. **CRA T4127 Payroll Deductions Formulas** — the formulas + all constants. New editions every Jan 1 and Jul 1. canada.ca → "T4127 Payroll deductions formulas".
2. **CRA PDOC** (Payroll Deductions Online Calculator) — golden-test oracle for verifying engine output.
3. CRA CPP contribution rates page + EI premium rate announcement (each fall for next year).
4. Revenu Québec TP-1015.3 / WebRAS (Phase 2 — QC income tax, QPP, QPIP).
5. Provincial budgets (Feb–Apr) for mid-year rate changes.

## Status of 2026 tables (as of 2026-06-10)
Seeded from model knowledge of the T4127 121st edition (effective 2026-01-01). **All tables `verified: false`** — web verification tools were unavailable during Phase 0. Confidence by item:

| Item | Values seeded | Confidence |
|---|---|---|
| Federal rates 14/20.5/26/29/33, thresholds 58,523/117,045/181,440/258,482 | high — 2% indexation on 2025, 14% rate legislated | High |
| BPAF 16,452/14,829; CEA 1,500 | derived ×1.02 | Medium-high |
| CPP: YMPE 74,900, exempt 3,500, 5.95%, max 4,248.30 | announced Nov 2025 | High |
| CPP2: YAMPE 85,400, 4%, max 420.00 | YAMPE rounding uncertain (could be 85,300) | Medium |
| EI: MIE 68,500, 1.63%, max 1,116.55; QC 1.30%/890.50 | announced Sept 2025 | High / QC Medium |
| ON, AB, BC, NB, NL, NT, NU, YT brackets/BPA | 2025 × estimated index factors | Medium |
| SK, MB, NS, PE brackets/BPA | 2025 reforms + estimates | Low-medium |
| ON surtax 5,824/7,453; health premium table | surtax indexed; premium table statutory (unchanged since 2004) | Medium / High |
| QC income tax, QPP, QPIP | placeholder only — engine throws | n/a (Phase 2) |

## Verification protocol (Phase 1, repeat each new edition)
1. Fetch T4127 current edition (canada.ca blocks plain fetch — use search-engine cache, the PDF, or manual copy if needed).
2. Diff every constant in `src/data/<year>/` against it; correct; set `meta.verified: true`, `lastReviewed`, cite edition.
3. PDOC golden run — 6 profiles: (a) min-wage hourly weekly, (b) $65k biweekly, (c) $120k semi-monthly (crosses CPP2), (d) $250k monthly (BPAF phase-out, top brackets), (e) TD1 with extra claims, (f) capped CPP/EI late-year YTD. × every jurisdiction. Record PDOC outputs in `tests/goldens.json`; engine must match within $0.05.
4. Commit with message `tax-data: verify <year> ed.<n>`.

## Update calendar (recurring)
| When | What |
|---|---|
| ~Nov 1 | CRA announces next-year CPP YMPE/YAMPE; EI rate (Sept) |
| ~Dec 15 | T4127 Jan edition published → build `data/<year>/`, verify, ship before first January pay date |
| Feb–Apr | Provincial budgets — watch for rate/BPA changes (often mid-year, e.g., 2025 federal rate cut) |
| ~Jun 15 | T4127 Jul edition → `data/<year>-jul/` if anything changed |

## Disclaimers (must appear in product)
- Pre-launch: "Calculations pending CRA verification — do not use for live payroll" whenever any active table is unverified.
- Always: results are estimates of statutory withholding; employer remains responsible for remittances. (Standard for all payroll software, incl. PDOC's own disclaimer.)
