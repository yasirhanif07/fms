"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import {
  TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS, EXPENSE_CATEGORY_LABELS, getBalanceDelta,
} from "@/lib/constants";
import { buildMonthlyPDF } from "@/lib/pdf";
import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthlyReportPage() {
  const { activeCompanyId, activeCompany } = useCompany();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetch(`/api/reports/monthly?companyId=${activeCompanyId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [activeCompanyId, year, month]);

  const handleExport = () => {
    if (!data || !activeCompany) return;
    const rows = data.transactions.map((tx: any) => ({
      date: new Date(tx.date).toLocaleDateString("en-PK"),
      type: TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
      category: tx.category ? EXPENSE_CATEGORY_LABELS[tx.category] : "—",
      description: tx.description || "—",
      addedBy: tx.addedBy.name,
      amount: formatPKR(tx.amount * getBalanceDelta(tx.type)),
      balance: formatPKR(tx.runningBalance),
    }));
    const doc = buildMonthlyPDF(
      activeCompany.name,
      `${MONTHS[month - 1]} ${year}`,
      data.summary,
      rows
    );
    doc.save(`monthly-report-${year}-${String(month).padStart(2, "0")}.pdf`);
  };

  if (!activeCompanyId) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Select a company first.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Link>
        <div className="flex items-center justify-between mt-3">
          <h1 className="text-2xl font-bold">Monthly Report</h1>
          <Button onClick={handleExport} variant="outline" disabled={!data}>
            <Download className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Income", value: data.summary.totalIncome, color: "text-green-600" },
            { label: "Total Expense", value: data.summary.totalExpense, color: "text-red-600" },
            { label: "Loan Given", value: data.summary.totalLoanGiven, color: "text-orange-600" },
            { label: "Net", value: data.summary.net, color: data.summary.net >= 0 ? "text-green-600" : "text-red-600" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{formatPKR(value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>}
              {!loading && data?.transactions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions for this period.</TableCell></TableRow>
              )}
              {data?.transactions.map((tx: any) => {
                const delta = getBalanceDelta(tx.type);
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${TRANSACTION_TYPE_COLORS[tx.type]} border-0`}>
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.category ? EXPENSE_CATEGORY_LABELS[tx.category] : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">{tx.description || "—"}</TableCell>
                    <TableCell className="text-sm">{tx.addedBy.name}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
                      {delta > 0 ? "+" : "−"}{formatPKR(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatPKR(tx.runningBalance)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
