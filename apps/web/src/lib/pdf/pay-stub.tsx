/**
 * PDF pay stub — premium bank-statement design via @react-pdf/renderer.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#1C1917" },
  header: { background: "linear-gradient(135deg, #B3261E, #8F1D17)", color: "#FFF", padding: "28 36", flexDirection: "row", justifyContent: "space-between" },
  headerLogo: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#FFF" },
  headerLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", letterSpacing: 3, opacity: 0.85 },
  headerValue: { fontSize: 11, opacity: 0.9, marginTop: 2 },
  empRow: { padding: "22 36 16", borderBottom: "1 solid #E7E5E4", flexDirection: "row", justifyContent: "space-between" },
  empLabel: { fontSize: 10, color: "#A8A29E", textTransform: "uppercase", letterSpacing: 1.5 },
  empName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 1 },
  empSub: { fontSize: 11, color: "#78716C" },
  grid: { padding: "20 36", flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#78716C", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 },
  earningsCard: { backgroundColor: "#F0FDF4", border: "1 solid #BBF7D0", borderRadius: 10, padding: 14, flexDirection: "row", justifyContent: "space-between" },
  earningsLabel: { fontSize: 12, color: "#15803D" },
  earningsValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#15803D" },
  ledger: { border: "1 solid #E7E5E4", borderRadius: 10, overflow: "hidden" },
  ledgerRow: { flexDirection: "row", justifyContent: "space-between", padding: "8 12", fontSize: 11 },
  ledgerRowAlt: { backgroundColor: "#FAFAF9" },
  ledgerTotal: { borderTop: "2 solid #E7E5E4", fontFamily: "Helvetica-Bold", padding: "10 12" },
  ledgerLabel: { color: "#57534E" },
  netBand: { margin: "4 36 20", background: "#FEF2F2", border: "1 solid #FECACA", borderRadius: 12, padding: "18 24", flexDirection: "row", justifyContent: "space-between" },
  netLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#991B1B", textTransform: "uppercase", letterSpacing: 1.5 },
  netSub: { fontSize: 10, color: "#B91C1C", opacity: 0.8, marginTop: 1 },
  netValue: { fontSize: 34, fontFamily: "Helvetica-Bold", color: "#B3261E" },
  footer: { padding: "14 36 28", borderTop: "1 solid #E7E5E4", flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 9, color: "#A8A29E" },
});

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

function LedgerRow({ label, value, alt, total }: { label: string; value: string; alt?: boolean; total?: boolean }) {
  return (
    <View style={total ? [styles.ledgerRow, styles.ledgerTotal] : alt ? [styles.ledgerRow, styles.ledgerRowAlt] : styles.ledgerRow}>
      <Text style={[styles.ledgerLabel, total ? { color: "#1C1917" } as const : {} as const]}>{label}</Text>
      <Text style={{ fontFamily: "Courier", color: total ? "#B3261E" : undefined }}>{value}</Text>
    </View>
  );
}

export interface PayStubPdfData {
  companyName: string; employeeName: string; payDate: string; payGroup: string;
  /** Wave 3 B5 — pay-period start (PayRun.periodStart); null on pre-B5 runs. */
  periodStart: string | null;
  /** Wave 4 (W4-D4) — the ACTUAL pay date (PayRun.actualPayDate). The
   *  PDF previously showed only the period end (payDate) and labelled
   *  it "Pay Date"; the pay date now renders as its own field. */
  actualPayDate: string | null;
  gross: number; cpp: number; cpp2: number; ei: number; federalTax: number; provincialTax: number;
  totalDeductions: number; netPay: number;
  /** Wave 4 (W4-D3) — Quebec split: when isQuebec, cpp/cpp2 render as
   *  QPP/QPP2, qpip renders as its own line (it was folded into EI),
   *  and the employer block splits employerEiPure / employerQpip out
   *  of the folded employerEi. ytdEi / ytdInsurable arrive PRE-SPLIT
   *  (EI-only) from the routes; ytdQpip / ytdQpipInsurable carry the
   *  Quebec shares. */
  isQuebec: boolean;
  qpip: number;
  employerEiPure: number; employerQpip: number;
  ytdQpip: number; ytdQpipInsurable: number;
  /** Wave 3 B5 — itemized earnings lines (Regular/Overtime/Stat/Vacation/Bonus…). */
  earnings: { label: string; detail: string | null; amount: number }[];
  /** Wave 3 B6 — named custom deduction lines. */
  customDeductions: { name: string; amount: number }[];
  /** Wave 3 B6 — non-taxable reimbursement added to net pay. */
  reimbursement: number;
  ytdPensionable: number; ytdCpp: number; ytdCpp2: number; ytdInsurable: number; ytdEi: number;
  /** Wave 3 B5 — YTD gross pay + income tax (YtdLedger, post-B5 runs). */
  ytdGrossPay: number; ytdIncomeTax: number;
  /** Wave 3 B5 — ACCRUE vacation balance snapshot (cents) after this run. */
  vacationBalanceAfterCents: number | null;
  employerCpp: number; employerCpp2: number; employerEi: number; employerTotal: number;
}

export function PayStubPdf({ data }: { data: PayStubPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.headerLogo}>
              <Text style={styles.headerName}>{data.companyName}</Text>
            </View>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", opacity: 1, marginTop: 6, color: "#FFF" }}>{data.companyName}</Text>
            <Text style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Employer payroll statement</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.headerLabel}>PAY STUB</Text>
            <Text style={styles.headerValue}>
              {data.periodStart ? `Pay Period · ${data.periodStart} → ${data.payDate}` : `Period End · ${data.payDate}`}
            </Text>
            {/* W4-D4 — the pay date always renders (it is NOT the period end). */}
            <Text style={styles.headerValue}>{`Pay Date · ${data.actualPayDate ?? data.payDate}`}</Text>
            <Text style={styles.headerValue}>{data.payGroup}</Text>
          </View>
        </View>

        {/* Employee */}
        <View style={styles.empRow}>
          <View>
            <Text style={styles.empLabel}>Employee</Text>
            <Text style={styles.empName}>{data.employeeName}</Text>
            <Text style={styles.empSub}>SIN •••-•••-•••</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.empLabel}>Pay Date</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 1 }}>
              {data.actualPayDate ?? data.payDate}
            </Text>
            <Text style={styles.empSub}>
              {data.periodStart ? `Period ${data.periodStart} → ${data.payDate}` : `Period end ${data.payDate}`}
            </Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.ledger}>
              {data.earnings.map((line, i) => (
                <LedgerRow
                  key={line.label}
                  label={line.detail ? `${line.label} · ${line.detail}` : line.label}
                  value={fmtCAD(line.amount)}
                  alt={i % 2 === 1}
                />
              ))}
              <LedgerRow label="Gross Pay" value={fmtCAD(data.gross)} total />
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Deductions</Text>
            <View style={styles.ledger}>
              <LedgerRow label={data.isQuebec ? "QPP" : "CPP"} value={fmtCAD(data.cpp)} />
              <LedgerRow label={data.isQuebec ? "QPP2" : "CPP2"} value={fmtCAD(data.cpp2)} alt />
              <LedgerRow label="EI" value={fmtCAD(data.ei)} />
              {data.isQuebec && <LedgerRow label="QPIP" value={fmtCAD(data.qpip)} alt />}
              <LedgerRow label="Federal Tax" value={fmtCAD(data.federalTax)} alt={!data.isQuebec} />
              <LedgerRow label={data.isQuebec ? "Quebec Tax" : "Provincial Tax"} value={fmtCAD(data.provincialTax)} />
              {data.customDeductions.map((d, i) => (
                <LedgerRow key={d.name} label={d.name} value={fmtCAD(d.amount)} alt={i % 2 === 0} />
              ))}
              <LedgerRow label="Total Deductions" value={fmtCAD(data.totalDeductions)} total />
            </View>
            {data.reimbursement !== 0 && (
              <View style={{ marginTop: 8 }}>
                <LedgerRow label="Reimbursement (non-taxable, added to net)" value={fmtCAD(data.reimbursement)} />
              </View>
            )}
          </View>
        </View>

        {/* Net Pay */}
        <View style={styles.netBand}>
          <View>
            <Text style={styles.netLabel}>Net Pay</Text>
            <Text style={styles.netSub}>Take-home amount</Text>
          </View>
          <Text style={styles.netValue}>{fmtCAD(data.netPay)}</Text>
        </View>

        {/* Employer + YTD */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Employer Costs</Text>
            <View style={styles.ledger}>
              <LedgerRow label={data.isQuebec ? "QPP Match" : "CPP Match"} value={fmtCAD(data.employerCpp)} />
              <LedgerRow label={data.isQuebec ? "QPP2 Match" : "CPP2 Match"} value={fmtCAD(data.employerCpp2)} alt />
              <LedgerRow label="EI (1.4×)" value={fmtCAD(data.employerEiPure)} />
              {data.isQuebec && <LedgerRow label="QPIP (employer)" value={fmtCAD(data.employerQpip)} alt />}
              <LedgerRow label="Total" value={fmtCAD(data.employerTotal)} total />
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Year to Date · 2026</Text>
            <View style={styles.ledger}>
              <LedgerRow label="Gross Pay" value={fmtCAD(data.ytdGrossPay)} />
              <LedgerRow label="Income Tax" value={fmtCAD(data.ytdIncomeTax)} alt />
              <LedgerRow label="Pensionable" value={fmtCAD(data.ytdPensionable)} />
              <LedgerRow label={data.isQuebec ? "Insurable (EI)" : "Insurable"} value={fmtCAD(data.ytdInsurable)} alt />
              {data.isQuebec && <LedgerRow label="Insurable (QPIP)" value={fmtCAD(data.ytdQpipInsurable)} />}
              <LedgerRow label={data.isQuebec ? "QPP" : "CPP"} value={fmtCAD(data.ytdCpp)} />
              <LedgerRow label="EI" value={fmtCAD(data.ytdEi)} alt />
              {data.isQuebec && <LedgerRow label="QPIP" value={fmtCAD(data.ytdQpip)} />}
              <LedgerRow label={data.isQuebec ? "QPP2" : "CPP2"} value={fmtCAD(data.ytdCpp2)} />
            </View>
            {data.vacationBalanceAfterCents != null && (
              <View style={{ marginTop: 8 }}>
                <LedgerRow
                  label="Vacation balance"
                  value={`$${(data.vacationBalanceAfterCents / 100).toFixed(2)}`}
                />
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Nexvar Pay · A NexvarLab product</Text>
          <Text style={styles.footerText}>For your records. Not an official CRA document.</Text>
        </View>
      </Page>
    </Document>
  );
}
