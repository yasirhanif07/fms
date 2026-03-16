import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPKR } from "./currency";

function addHeader(doc: jsPDF, title: string, companyName: string) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FMS — Financial Management System", 14, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Company: ${companyName}`, 14, 30);
  doc.text(`Report: ${title}`, 14, 38);
  doc.text(`Currency: PKR`, 14, 46);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}`, 14, 54);

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 58, doc.internal.pageSize.width - 14, 58);
}

export function buildMonthlyPDF(
  companyName: string,
  period: string,
  summary: { totalIncome: number; totalExpense: number; net: number },
  rows: {
    date: string;
    type: string;
    category: string;
    description: string;
    addedBy: string;
    amount: string;
    balance: string;
  }[]
) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, `Monthly Report — ${period}`, companyName);

  // Summary section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Income: ${formatPKR(summary.totalIncome)}   |   Total Expense: ${formatPKR(summary.totalExpense)}   |   Net: ${formatPKR(summary.net)}`, 14, 66);

  autoTable(doc, {
    startY: 72,
    head: [["Date", "Type", "Category", "Description", "Added By", "Amount (PKR)", "Balance (PKR)"]],
    body: rows.map((r) => [r.date, r.type, r.category, r.description, r.addedBy, r.amount, r.balance]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138] },
  });

  return doc;
}

export function buildOverallPDF(
  companyName: string,
  summary: { totalIncome: number; totalExpense: number; net: number },
  rows: { period: string; income: string; expense: string; net: string }[]
) {
  const doc = new jsPDF();
  addHeader(doc, "Overall Summary Report", companyName);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Income: ${formatPKR(summary.totalIncome)}   |   Total Expense: ${formatPKR(summary.totalExpense)}   |   Net: ${formatPKR(summary.net)}`, 14, 66);

  autoTable(doc, {
    startY: 72,
    head: [["Period", "Income (PKR)", "Expense (PKR)", "Net (PKR)"]],
    body: rows.map((r) => [r.period, r.income, r.expense, r.net]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 138] },
  });

  return doc;
}

export function buildPartnerPDF(
  companyName: string,
  rows: { name: string; total: string; loan: string; holdings: string }[],
  totals: { total: number; loan: number; holdings: number }
) {
  const doc = new jsPDF();
  addHeader(doc, "Partner Holdings Report", companyName);

  autoTable(doc, {
    startY: 66,
    head: [["Person", "Total (PKR)", "Loan (PKR)", "Holdings (PKR)"]],
    body: rows.map((r) => [r.name, r.total, r.loan, r.holdings]),
    foot: [["Total", formatPKR(totals.total), formatPKR(totals.loan), formatPKR(totals.holdings)]],
    styles: { fontSize: 10, halign: "right" },
    columnStyles: { 0: { halign: "left" } },
    headStyles: { fillColor: [30, 58, 138], fontStyle: "bold" },
    footStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: "bold" },
  });

  return doc;
}
