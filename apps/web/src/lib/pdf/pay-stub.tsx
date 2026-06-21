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
  gross: number; cpp: number; cpp2: number; ei: number; federalTax: number; provincialTax: number;
  totalDeductions: number; netPay: number;
  ytdPensionable: number; ytdCpp: number; ytdCpp2: number; ytdInsurable: number; ytdEi: number;
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
              <Text>🍁</Text>
              <Text style={styles.headerName}>{data.companyName}</Text>
            </View>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", opacity: 1, marginTop: 6, color: "#FFF" }}>{data.companyName}</Text>
            <Text style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Employer payroll statement</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.headerLabel}>PAY STUB</Text>
            <Text style={styles.headerValue}>Pay Date · {data.payDate}</Text>
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
            <Text style={styles.empLabel}>Pay Period</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 1 }}>{data.payDate}</Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Gross Pay</Text>
              <Text style={styles.earningsValue}>{fmtCAD(data.gross)}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Deductions</Text>
            <View style={styles.ledger}>
              <LedgerRow label="CPP" value={fmtCAD(data.cpp)} />
              <LedgerRow label="CPP2" value={fmtCAD(data.cpp2)} alt />
              <LedgerRow label="EI" value={fmtCAD(data.ei)} />
              <LedgerRow label="Federal Tax" value={fmtCAD(data.federalTax)} alt />
              <LedgerRow label="Provincial Tax" value={fmtCAD(data.provincialTax)} />
              <LedgerRow label="Total Deductions" value={fmtCAD(data.totalDeductions)} total />
            </View>
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
              <LedgerRow label="CPP Match" value={fmtCAD(data.employerCpp)} />
              <LedgerRow label="CPP2 Match" value={fmtCAD(data.employerCpp2)} alt />
              <LedgerRow label="EI (1.4×)" value={fmtCAD(data.employerEi)} />
              <LedgerRow label="Total" value={fmtCAD(data.employerTotal)} total />
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Year to Date · 2026</Text>
            <View style={styles.ledger}>
              <LedgerRow label="Pensionable" value={fmtCAD(data.ytdPensionable)} />
              <LedgerRow label="Insurable" value={fmtCAD(data.ytdInsurable)} alt />
              <LedgerRow label="CPP" value={fmtCAD(data.ytdCpp)} />
              <LedgerRow label="EI" value={fmtCAD(data.ytdEi)} alt />
              <LedgerRow label="CPP2" value={fmtCAD(data.ytdCpp2)} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by 🍁 MapleRun</Text>
          <Text style={styles.footerText}>For your records. Not an official CRA document.</Text>
        </View>
      </Page>
    </Document>
  );
}
