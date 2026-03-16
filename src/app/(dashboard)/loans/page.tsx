"use client";

import { useEffect, useState, useCallback } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";

interface LoanTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  date: string;
  loanDirection: string | null;
  addedBy: { name: string };
}

export default function LoansPage() {
  const { activeCompanyId } = useCompany();
  const [loans, setLoans] = useState<LoanTx[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const res = await fetch(
      `/api/transactions?companyId=${activeCompanyId}&limit=200`
    );
    if (res.ok) {
      const data = await res.json();
      const loanTxs = data.transactions.filter((tx: LoanTx) =>
        ["LOAN_GIVEN", "LOAN_RECEIVED", "LOAN_REPAYMENT"].includes(tx.type)
      );
      setLoans(loanTxs);
    }
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  // Compute net loan position
  let netLoanGiven = 0;
  let netLoanReceived = 0;
  for (const tx of loans) {
    if (tx.type === "LOAN_GIVEN") netLoanGiven += tx.amount;
    else if (tx.type === "LOAN_RECEIVED") netLoanReceived += tx.amount;
    else if (tx.type === "LOAN_REPAYMENT") {
      if (tx.loanDirection === "INFLOW") netLoanGiven -= tx.amount;
      else if (tx.loanDirection === "OUTFLOW") netLoanReceived -= tx.amount;
    }
  }

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Link href="/transactions/new">
          <Button>+ Record Loan</Button>
        </Link>
      </div>

      {/* Net Summary */}
      <div className="grid sm:grid-cols-2 gap-4">
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
                <p className="text-xl font-bold text-orange-600">{formatPKR(Math.max(0, netLoanGiven))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2.5 rounded-lg">
                <Landmark className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Loans We Received (Outstanding)
                </p>
                <p className="text-xl font-bold text-blue-600">{formatPKR(Math.max(0, netLoanReceived))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Transaction History */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No loan transactions found.
                  </TableCell>
                </TableRow>
              )}
              {loans.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${TRANSACTION_TYPE_COLORS[tx.type]} border-0`}>
                      {TRANSACTION_TYPE_LABELS[tx.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.loanDirection
                      ? tx.loanDirection === "INFLOW" ? "Received Repayment" : "Paid Repayment"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{tx.description || "—"}</TableCell>
                  <TableCell className="text-sm">{tx.addedBy.name}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatPKR(tx.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
