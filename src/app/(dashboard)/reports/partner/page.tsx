"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import { buildPartnerPDF } from "@/lib/pdf";
import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PartnerReportPage() {
  const { activeCompanyId, activeCompany } = useCompany();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetch(`/api/reports/partner?companyId=${activeCompanyId}`)
      .then((r) => r.json())
      .then((d) => { setPartners(d); setLoading(false); });
  }, [activeCompanyId]);

  const totals = partners.reduce(
    (acc, p) => ({
      total: acc.total + p.income,
      loan: acc.loan + p.loanGiven,
      holdings: acc.holdings + (p.income - p.loanGiven),
    }),
    { total: 0, loan: 0, holdings: 0 }
  );

  const handleExport = () => {
    if (!activeCompany) return;
    const rows = partners.map((p) => ({
      name: p.partnerName,
      total: formatPKR(p.income),
      loan: formatPKR(p.loanGiven),
      holdings: formatPKR(p.income - p.loanGiven),
    }));
    const doc = buildPartnerPDF(activeCompany.name, rows, totals);
    doc.save("partner-report.pdf");
  };

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Link>
        <div className="flex items-center justify-between mt-3">
          <h1 className="text-2xl font-bold">Partner Report</h1>
          <Button onClick={handleExport} variant="outline" disabled={partners.length === 0}>
            <Download className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-900 hover:bg-slate-900">
                <TableHead className="text-white font-bold">Person</TableHead>
                <TableHead className="text-right text-white font-bold">Total</TableHead>
                <TableHead className="text-right text-white font-bold">Loan</TableHead>
                <TableHead className="text-right text-white font-bold">Holdings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && partners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No partners found.</TableCell>
                </TableRow>
              )}
              {partners.map((p) => {
                const holdings = p.income - p.loanGiven;
                return (
                  <TableRow key={p.partnerId}>
                    <TableCell className="font-medium">{p.partnerName}</TableCell>
                    <TableCell className="text-right text-sm">{formatPKR(p.income)}</TableCell>
                    <TableCell className="text-right text-sm text-orange-600">{formatPKR(p.loanGiven)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-green-700">{formatPKR(holdings)}</TableCell>
                  </TableRow>
                );
              })}
              {!loading && partners.length > 0 && (
                <TableRow className="bg-green-800 hover:bg-green-800 font-bold text-white">
                  <TableCell className="text-white font-bold">Total</TableCell>
                  <TableCell className="text-right text-white font-bold">{formatPKR(totals.total)}</TableCell>
                  <TableCell className="text-right text-white font-bold">{formatPKR(totals.loan)}</TableCell>
                  <TableCell className="text-right text-white font-bold">{formatPKR(totals.holdings)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
