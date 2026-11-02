/**
 * Quebec split-display math (Wave 4 defects W4-D3).
 *
 * Storage is split correctly (PayRunItem carries qpp/qpp2/qpip — the
 * RL-1 ties to the cent), but several display surfaces folded the
 * Quebec amounts back into the CPP/EI figures. The helpers here are
 * the ONE place that recovers the split presentation from stored
 * amounts, so the preview, stubs, T4 and remittance surfaces cannot
 * drift apart again.
 *
 * The one genuinely folded stored figure is the employer's: the tax
 * engine's employer EI total for a Quebec item is EI + QPIP combined
 * (PayResult.employer.ei). The split is recovered arithmetically —
 * employer EI is the employee premium × 1.4 (the statutory EI employer
 * multiple, the same constant the engine's tables carry), so employer
 * QPIP = stored employer EI − round2(employee EI × 1.4). For the
 * Prairie Peak proof figures (EI 62.40, employer EI 116.26) this
 * returns exactly 28.90 / 87.36.
 */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Statutory EI employer multiple (engine EI table: employerMultiple). */
export const EI_EMPLOYER_MULTIPLE = 1.4;

/** Employer QPIP premium folded inside a Quebec item's employerEi. */
export function employerQpipAmount(item: { ei: number; qpip?: number | null; employerEi: number }): number {
  if (!item.qpip || item.qpip <= 0) return 0;
  return Math.max(0, round2(item.employerEi - round2(item.ei * EI_EMPLOYER_MULTIPLE)));
}

/** Employer EI premium with any folded QPIP removed. */
export function employerEiPure(item: { ei: number; qpip?: number | null; employerEi: number }): number {
  return round2(item.employerEi - employerQpipAmount(item));
}

/** True when an item carries Quebec split amounts (a QC-finalized item). */
export function hasQuebecSplits(item: { qpp?: number | null; qpp2?: number | null; qpip?: number | null }): boolean {
  return (item.qpp ?? 0) > 0 || (item.qpp2 ?? 0) > 0 || (item.qpip ?? 0) > 0;
}

export interface QuebecYtdSplit {
  /** Cumulative employee QPIP up to and including the target item. */
  ytdQpip: number;
  /** YTD EI premiums with QPIP removed (the snapshot blends them). */
  ytdEiPure: number;
  /** YTD QPIP insurable earnings (see derivation note). */
  ytdQpipInsurable: number;
  /** YTD EI insurable earnings with the QPIP share removed. */
  ytdEiInsurable: number;
}

/**
 * Split a Quebec employee's blended YTD snapshots at a target item.
 *
 * The engine's YTD ledger blends QPIP into both accumulations
 * (newYtd.ei adds the QPIP premium; newYtd.insurableEarnings adds the
 * QPIP insurable base) — which is why Sophie's stub showed YTD EI
 * $83.04 (62.40 + 20.64) and YTD insurable $9,600 (4,800 + 4,800).
 *
 * - Premiums split EXACTLY: Σ item.qpip up to the target is the QPIP
 *   part; the remainder of the ytdEi snapshot is EI.
 * - Insurable earnings: the engine feeds the SAME insurable base to
 *   EI and QPIP, so a QPIP-bearing item's blended ytdInsurable delta
 *   is half EI / half QPIP. Items are consumed in finalization order
 *   up to and including the target; each item's delta is the change
 *   in its stored snapshot. (Known exception: an EI-exempt Quebec
 *   item accrues no QPIP, so its delta is all EI — the qpip > 0 test
 *   handles exactly that case.)
 */
export function splitQuebecYtd(
  itemsInFinalizationOrder: readonly { id: string; qpip: number; ytdInsurable: number }[],
  targetItemId: string,
  blendedYtdEi: number,
  blendedYtdInsurable: number,
): QuebecYtdSplit {
  let cumQpip = 0;
  let qpipInsurable = 0;
  let prevInsurable = 0;
  for (const it of itemsInFinalizationOrder) {
    cumQpip += it.qpip;
    const delta = it.ytdInsurable - prevInsurable;
    prevInsurable = it.ytdInsurable;
    if (it.qpip > 0) qpipInsurable += delta / 2;
    if (it.id === targetItemId) break;
  }
  return {
    ytdQpip: round2(cumQpip),
    ytdEiPure: round2(blendedYtdEi - cumQpip),
    ytdQpipInsurable: round2(qpipInsurable),
    ytdEiInsurable: round2(blendedYtdInsurable - qpipInsurable),
  };
}
