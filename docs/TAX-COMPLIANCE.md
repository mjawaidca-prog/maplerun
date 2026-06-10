# Tax Compliance: Sources, Status, Protocol

## Status: 2026 tables VERIFIED ✅ (2026-06-10)
All federal, CPP/CPP2, EI, and 12 provincial/territorial tables verified against **CRA T4127 121st edition (Jan 2026, including the May-2026 PEI update)** plus CRA's CPP and EI rate pages. Raw source HTML preserved in `docs/sources/` (cra-t4127.html, cra-cpp.html, cra-cpp2.html, cra-ei.html) for audit. Quebec provincial tax = Phase 2 (verified QPP/QPIP/abatement constants already captured in `data/2026/quebec.ts`).

Corrections found during verification (why this protocol exists — seeded estimates had real errors):
- CPP: YMPE 74,600 (not 74,900) → max $4,230.45; YAMPE 85,000 → CPP2 max $416.00
- EI: MIE 68,900 (not 68,500) → max $1,123.07 / QC $895.70
- MB froze brackets (47,000/100,000) and BPA ($15,780, phases to $0 over $200k–$400k income)
- NS BPA now flat $11,932 for everyone (income test removed for 2026)
- SK BPA $20,381 (Affordability Act +$500/yr); PE BPA $15,000, no indexation, top threshold updated May 2026
- ON: BPA 12,989; surtax thresholds 5,818/7,446
- Formula features added: ON tax reduction (S, base $300), BC tax reduction (S, $575 / 3.56% / $25,570–$41,722), AB K5P credit top-up (25% over $4,896), YT K4P (CEA $1,501)

## Known unmodelled items (rare; revisit by Phase 5)
- LCP labour-sponsored fund credits (fed 15%/$750; MB/NB/NS/SK variants)
- ON factor Y (dependant add-on to the tax reduction) — omitting only over-withholds, reconciles at T1
- TD1X commission method; "outside Canada" 48% surtax; CPP PM-proration (mid-year 18th birthday/70th/disability)
- F5 allocation on bonuses: CRA prorates the period CPP exemption across regular+bonus; we allocate to regular pay (≤ pennies difference, documented in calc/bonus.ts)

## Authoritative sources (priority order)
1. **CRA T4127** (formulas + constants; Jan & Jul editions). canada.ca blocks plain fetchers — download with a browser User-Agent via `Invoke-WebRequest` (worked 2026-06-10), save into `docs/sources/`.
2. **CRA PDOC** — end-to-end oracle for spot-checks (optional extra assurance; formulas already verified at constant level).
3. CRA CPP rates / CPP2 rates / EI premium pages (fall announcements for next year).
4. Revenu Québec TP-1015.3 / WebRAS (Phase 2).

## Verification protocol (repeat for every new edition)
1. Download the new T4127 edition pages into `docs/sources/` (browser UA).
2. Diff every constant in `src/data/<year>/` (Table 8.1 brackets/K, Table 8.2 BPAs/CEA/surtax/S2, Tables 8.3–8.8 CPP/QPP/EI/QPIP, ch. 2 BPAF/BPAMB/BPAYT formulas, ch. 6 provincial factors).
3. Cross-check engine-derived K/KP constants against published values (must match within $0.50).
4. Update `meta` (verified/source/lastReviewed), run tests, update goldens if rates moved, commit `tax-data: verify <year> ed.<n>`.

## Update calendar (recurring)
| When | What |
|---|---|
| ~Sept | CEIC sets next-year EI rate/MIE |
| ~Nov 1 | CRA announces next-year CPP YMPE/YAMPE |
| ~Dec 15 | T4127 Jan edition → build `data/<year>/`, verify before first Jan pay date |
| Feb–Apr | Provincial budgets (watch MB/NS/PE/SK — they've changed structurally two years running) |
| ~Jun 15 | T4127 Jul edition → check for mid-year changes (2026 Jan page already carries a May PE update) |

## Disclaimers (must appear in product)
- If any active table is unverified: "Calculations pending CRA verification — do not use for live payroll." (Engine emits this automatically.)
- Always: results are estimates of statutory withholding; the employer remains responsible for remittances.
