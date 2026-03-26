"use client";

import { useEffect, useState, useCallback } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import { Landmark } from "lucide-react";

interface PartnerLoanEntry {
  id: string;
  amount: number;
  description: string | null;
  date: string;
}

interface PartnerHolding {
  id: string;
  name: string;
  loan: number;
  loans: PartnerLoanEntry[];
}

export default function LoansPage() {
  const { activeCompanyId } = useCompany();
  const [partners, setPartners] = useState<PartnerHolding[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const res = await fetch(`/api/dashboard?companyId=${activeCompanyId}`);
    if (res.ok) {
      const data = await res.json();
      setPartners(data.partnerHoldings);
    }
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalLoans = partners.reduce((s, p) => s + p.loan, 0);

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Loans</h1>

      {/* Total outstanding */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2.5 rounded-lg">
              <Landmark className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Loans We Gave (Outstanding)
              </p>
              <p className="text-xl font-bold text-orange-600">{formatPKR(totalLoans)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-partner breakdown */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        partners
          .filter((p) => p.loan > 0 || p.loans.length > 0)
          .map((p) => (
            <Card key={p.id}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-orange-50/50">
                  <span className="font-semibold text-sm">{p.name}</span>
                  <span className="text-orange-600 font-bold text-sm">{formatPKR(p.loan)}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.loans.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                          No loan entries recorded.
                        </TableCell>
                      </TableRow>
                    )}
                    {p.loans.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(l.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-sm">{l.description || "—"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-orange-600">
                          {formatPKR(l.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
      )}

      {!loading && partners.filter((p) => p.loan > 0 || p.loans.length > 0).length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">No outstanding loans.</p>
      )}
    </div>
  );
}
