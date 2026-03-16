"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import { buildOverallPDF } from "@/lib/pdf";
import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OverallReportPage() {
  const { activeCompanyId, activeCompany } = useCompany();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetch(`/api/reports/overall?companyId=${activeCompanyId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [activeCompanyId]);

  const handleExport = () => {
    if (!data || !activeCompany) return;
    const rows = data.monthlyBreakdown.map((r: any) => ({
      period: r.period,
      income: formatPKR(r.income),
      expense: formatPKR(r.expense),
      net: formatPKR(r.net),
    }));
    const doc = buildOverallPDF(activeCompany.name, data.summary, rows);
    doc.save("overall-report.pdf");
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
          <h1 className="text-2xl font-bold">Overall Summary</h1>
          <Button onClick={handleExport} variant="outline" disabled={!data}>
            <Download className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Income", value: data.summary.totalIncome, color: "text-green-600" },
            { label: "Total Expense", value: data.summary.totalExpense, color: "text-red-600" },
            { label: "Loan Given", value: data.summary.totalLoanGiven, color: "text-orange-600" },
            { label: "Net Profit", value: data.summary.net, color: data.summary.net >= 0 ? "text-green-600" : "text-red-600" },
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">Loan Given</TableHead>
                <TableHead className="text-right">Loan Received</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>}
              {!loading && data?.monthlyBreakdown.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data yet.</TableCell></TableRow>
              )}
              {data?.monthlyBreakdown.map((r: any) => (
                <TableRow key={r.period}>
                  <TableCell className="font-medium">{r.period}</TableCell>
                  <TableCell className="text-right text-green-600">{formatPKR(r.income)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatPKR(r.expense)}</TableCell>
                  <TableCell className="text-right text-orange-600">{formatPKR(r.loanGiven)}</TableCell>
                  <TableCell className="text-right text-blue-600">{formatPKR(r.loanReceived)}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPKR(r.net)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
