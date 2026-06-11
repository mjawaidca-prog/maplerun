/**
 * PDF pay stub document using @react-pdf/renderer.
 * Server-side renderable — no browser needed.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  stubLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  employeeInfo: {
    textAlign: "right",
    fontSize: 10,
  },
  employeeName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  muted: {
    color: "#666",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginVertical: 12,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    color: "#666",
    letterSpacing: 1,
    marginBottom: 8,
  },
  columns: {
    flexDirection: "row",
    gap: 48,
  },
  column: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  rowLabel: {
    color: "#555",
  },
  rowValue: {
    fontFamily: "Helvetica",
  },
  rowBold: {
    fontFamily: "Helvetica-Bold",
  },
  netPayBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f0f7f4",
    borderRadius: 6,
    marginVertical: 8,
  },
  netPayLabel: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  netPayValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
  },
  ytdGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  ytdItem: {
    width: "30%",
    paddingVertical: 4,
  },
  ytdLabel: {
    fontSize: 8,
    color: "#888",
  },
  ytdValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
  },
  footerLine: {
    marginBottom: 4,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCAD(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  const labelStyle = bold ? [styles.rowLabel, styles.rowBold] : styles.rowLabel;
  const valueStyle = bold ? [styles.rowValue, styles.rowBold] : styles.rowValue;
  return (
    <View style={styles.row}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PayStubPdfData {
  companyName: string;
  employeeName: string;
  payDate: string;
  payGroup: string;
  gross: number;
  cpp: number;
  cpp2: number;
  ei: number;
  federalTax: number;
  provincialTax: number;
  totalDeductions: number;
  netPay: number;
  ytdPensionable: number;
  ytdCpp: number;
  ytdCpp2: number;
  ytdInsurable: number;
  ytdEi: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  employerTotal: number;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function PayStubPdf({ data }: { data: PayStubPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>
              🍁 {data.companyName}
            </Text>
            <Text style={styles.stubLabel}>Pay Stub</Text>
          </View>
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>{data.employeeName}</Text>
            <Text style={styles.muted}>Pay date: {data.payDate}</Text>
            <Text style={styles.muted}>{data.payGroup}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Earnings & Deductions */}
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <Row label="Gross pay" value={fmtCAD(data.gross)} bold />
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Deductions</Text>
            <Row label="CPP / QPP" value={fmtCAD(data.cpp)} />
            <Row label="CPP2 enhancement" value={fmtCAD(data.cpp2)} />
            <Row label="EI premiums" value={fmtCAD(data.ei)} />
            <Row label="Federal income tax" value={fmtCAD(data.federalTax)} />
            <Row
              label="Provincial income tax"
              value={fmtCAD(data.provincialTax)}
            />
            <View style={styles.divider} />
            <Row
              label="Total deductions"
              value={fmtCAD(data.totalDeductions)}
              bold
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Net pay */}
        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>Net Pay</Text>
          <Text style={styles.netPayValue}>{fmtCAD(data.netPay)}</Text>
        </View>

        <View style={styles.divider} />

        {/* YTD summary */}
        <Text style={styles.sectionTitle}>Year-to-Date (2026)</Text>
        <View style={styles.ytdGrid}>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>Pensionable earnings</Text>
            <Text style={styles.ytdValue}>
              {fmtCAD(data.ytdPensionable)}
            </Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>CPP contributed</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdCpp)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>CPP2 contributed</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdCpp2)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>Insurable earnings</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdInsurable)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>EI contributed</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdEi)}</Text>
          </View>
        </View>

        {/* YTD summary */}
        <Text style={styles.sectionTitle}>Year-to-Date (2026)</Text>
        <View style={styles.ytdGrid}>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>Pensionable earnings</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdPensionable)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>CPP contributed</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdCpp)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>CPP2 contributed</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdCpp2)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>Insurable earnings</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdInsurable)}</Text>
          </View>
          <View style={styles.ytdItem}>
            <Text style={styles.ytdLabel}>EI contributed</Text>
            <Text style={styles.ytdValue}>{fmtCAD(data.ytdEi)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Employer costs */}
        <Text style={styles.sectionTitle}>Employer Costs</Text>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Row label="CPP (employer match)" value={fmtCAD(data.employerCpp)} />
            <Row label="CPP2 (employer)" value={fmtCAD(data.employerCpp2)} />
            <Row label="EI (1.4× employee)" value={fmtCAD(data.employerEi)} />
            <View style={styles.divider} />
            <Row label="Total employer cost" value={fmtCAD(data.employerTotal)} bold />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLine}>
            Generated by MapleRun — Canadian payroll software.
          </Text>
          <Text style={styles.footerLine}>
            This is not an official CRA document. Retain for your records.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
