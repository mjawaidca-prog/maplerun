/**
 * ROE reason codes per CRA:
 * A — Shortage of work / end of contract
 * B — Strike or lockout
 * C — Return to school
 * D — Illness or injury
 * E — Quit
 * F — Maternity leave
 * G — Parental leave
 * H — Compassionate care leave
 * J — Apprentice training
 * K — Other (explain in comments)
 * M — Dismissal
 * N — Leave of absence
 * P — Retirement
 * Z — Compassionate care / critical illness
 */
export const ROE_REASON_CODES: Record<string, string> = {
  A: "Shortage of work / end of contract",
  B: "Strike or lockout",
  C: "Return to school",
  D: "Illness or injury",
  E: "Quit",
  F: "Maternity leave",
  G: "Parental leave",
  H: "Compassionate care leave",
  J: "Apprentice training",
  K: "Other",
  M: "Dismissal",
  N: "Leave of absence",
  P: "Retirement",
  Z: "Compassionate care / critical illness",
};
