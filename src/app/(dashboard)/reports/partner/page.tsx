"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import { buildPartnerPDF } from "@/lib/pdf";
import { Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-800",
  PARTNER: "bg-green-100 text-green-800",
  VIEWER: "bg-slate-100 text-slate-600",
};

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

  const handleExport = () => {
    if (!activeCompany) return;
    const rows = partners.map((p) => ({
      name: p.partnerName,
      email: p.partnerEmail,
      role: p.role,
      income: formatPKR(p.income),
      expense: formatPKR(p.expense),
      loanGiven: formatPKR(p.loanGiven),
      loanReceived: formatPKR(p.loanReceived),
      total: String(p.totalTransactions),
    }));
    const doc = buildPartnerPDF(activeCompany.name, rows);
    doc.save("partner-report.pdf");
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
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Income Added</TableHead>
                <TableHead className="text-right">Expense Added</TableHead>
                <TableHead className="text-right">Loan Given</TableHead>
                <TableHead className="text-right">Loan Received</TableHead>
                <TableHead className="text-right">Total Txs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>}
              {!loading && partners.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No partners found.</TableCell></TableRow>
              )}
              {partners.map((p) => (
                <TableRow key={p.partnerId}>
                  <TableCell className="font-medium">{p.partnerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.partnerEmail}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${ROLE_COLORS[p.role]} border-0`}>{p.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-green-600 text-sm">{formatPKR(p.income)}</TableCell>
                  <TableCell className="text-right text-red-600 text-sm">{formatPKR(p.expense)}</TableCell>
                  <TableCell className="text-right text-orange-600 text-sm">{formatPKR(p.loanGiven)}</TableCell>
                  <TableCell className="text-right text-blue-600 text-sm">{formatPKR(p.loanReceived)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{p.totalTransactions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
