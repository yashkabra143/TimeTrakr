import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

// ── Data Interface ──────────────────────────────────────────────────────────

export interface TaxReportData {
  fy: string; // e.g. "FY 2025-26"
  generatedDate: string; // e.g. "28 Mar 2026"

  // Totals
  grossUsd: number;
  netUsd: number;
  netInr: number;
  platformTdsInr: number;
  gstPaidInr: number;

  // Tax
  taxSlabRate: number;
  estimatedTax: number;
  projectedAnnualInr: number;

  // Installments
  installments: Array<{
    label: string;
    dueDate: string;
    cumPct: number;
    payNow: number;
    isPast: boolean;
  }>;

  // GST
  isGstRegistered: boolean;
  quarterlyGst: Record<string, number>;

  // TDS
  indianTdsTotal: number;
  totalTdsCredit: number;
  tdsEntries: Array<{
    deductorName: string;
    amount: number;
    grossAmount: number;
    quarter: string;
    panNumber?: string | null;
    certificateNumber?: string | null;
  }>;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#f59e0b",
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1a1a1a",
    backgroundColor: "#fef3c7",
    padding: 6,
    borderRadius: 4,
  },
  table: {
    display: "flex",
    flexDirection: "column",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    padding: 6,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    padding: 6,
    fontSize: 9,
  },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" },
  summaryRow: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fef3c7",
    marginTop: 4,
    borderRadius: 4,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "INR"): string {
  if (currency === "USD") return `$${Math.round(n).toLocaleString("en-IN")}`;
  return `\u20B9${Math.round(n).toLocaleString("en-IN")}`;
}

// ── TaxPDFReport Component ───────────────────────────────────────────────────

export function TaxPDFReport({ data }: { data: TaxReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TimeTrakr — CA-Ready Tax Summary</Text>
          <Text style={styles.subtitle}>
            {data.fy} · Generated {data.generatedDate}
          </Text>
        </View>

        {/* Income Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income Summary</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Gross Earnings (USD)</Text>
              <Text style={styles.cellRight}>{fmt(data.grossUsd, "USD")}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Net Earnings (USD)</Text>
              <Text style={styles.cellRight}>{fmt(data.netUsd, "USD")}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Net Earnings (INR)</Text>
              <Text style={styles.cellRight}>{fmt(data.netInr)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Projected Annual Income (INR)</Text>
              <Text style={styles.cellRight}>{fmt(data.projectedAnnualInr)}</Text>
            </View>
          </View>
        </View>

        {/* Tax Liability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Liability Estimate</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Tax Slab Rate</Text>
              <Text style={styles.cellRight}>{data.taxSlabRate}%</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Estimated Tax Liability</Text>
              <Text style={styles.cellRight}>{fmt(data.estimatedTax)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Platform TDS Credit</Text>
              <Text style={styles.cellRight}>{fmt(data.platformTdsInr)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Indian Client TDS Credit</Text>
              <Text style={styles.cellRight}>{fmt(data.indianTdsTotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.cell}>Total TDS Credit</Text>
              <Text style={styles.cellRight}>{fmt(data.totalTdsCredit)}</Text>
            </View>
          </View>
        </View>

        {/* Advance Tax Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advance Tax Schedule</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cell}>Installment</Text>
              <Text style={styles.cell}>Due Date</Text>
              <Text style={styles.cellRight}>Cumulative %</Text>
              <Text style={styles.cellRight}>Amount</Text>
            </View>
            {data.installments.map((inst, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.cell}>{inst.label}</Text>
                <Text style={styles.cell}>{inst.dueDate}</Text>
                <Text style={styles.cellRight}>{inst.cumPct}%</Text>
                <Text style={styles.cellRight}>{fmt(inst.payNow)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* GST Tracker (if registered) */}
        {data.isGstRegistered && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GST Input Tax Credit</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.cell}>Quarter</Text>
                <Text style={styles.cellRight}>GST Paid (ITC)</Text>
              </View>
              {Object.entries(data.quarterlyGst).map(([quarter, amount], i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.cell}>{quarter}</Text>
                  <Text style={styles.cellRight}>{fmt(amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TDS Entries */}
        {data.tdsEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TDS Certificates (Sec 194J)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.cell, flex: 2 }}>Deductor</Text>
                <Text style={styles.cell}>Quarter</Text>
                <Text style={styles.cellRight}>Gross (INR)</Text>
                <Text style={styles.cellRight}>TDS (INR)</Text>
              </View>
              {data.tdsEntries.map((entry, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={{ ...styles.cell, flex: 2 }}>{entry.deductorName}</Text>
                  <Text style={styles.cell}>{entry.quarter}</Text>
                  <Text style={styles.cellRight}>{fmt(entry.grossAmount)}</Text>
                  <Text style={styles.cellRight}>{fmt(entry.amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by TimeTrakr · {data.generatedDate} · Estimates only — consult a Chartered Accountant for actual tax liability
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Download Function ────────────────────────────────────────────────────────

export async function downloadTaxPDF(data: TaxReportData): Promise<void> {
  const blob = await pdf(<TaxPDFReport data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetrakr-tax-report-${data.fy.replace(/\s/g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
