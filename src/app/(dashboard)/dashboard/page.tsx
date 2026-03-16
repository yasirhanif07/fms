"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IncomeExpenseChart } from "@/components/dashboard/IncomeExpenseChart";
import { formatPKR } from "@/lib/currency";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from "@/lib/constants";

interface PartnerHolding {
  id: string;
  name: string;
  role: string;
  total: number;
  loan: number;
  holdings: number;
}

interface DashboardData {
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  outstandingLoans: number;
  chartData: { month: string; year: number; income: number; expense: number }[];
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    description: string | null;
    date: string;
    runningBalance: number;
    addedBy: { name: string };
  }[];
  partnerHoldings: PartnerHolding[];
}

interface EditState {
  partnerId: string;
  total: string;
  holdings: string;
  saving: boolean;
}

export default function DashboardPage() {
  const { activeCompanyId, activeCompany } = useCompany();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);

  const fetchDashboard = () => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetch(`/api/dashboard?companyId=${activeCompanyId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, [activeCompanyId]);

  const handleSaveAdjustment = async () => {
    if (!editState || !activeCompanyId) return;
    const original = data?.partnerHoldings.find((p) => p.id === editState.partnerId);
    if (!original) return;

    setEditState({ ...editState, saving: true });

    const newTotal = parseFloat(editState.total) || 0;
    const newHoldings = parseFloat(editState.holdings) || 0;
    const newLoan = newTotal - newHoldings; // Loan = Total - Holdings

    const calls = [];
    if (newTotal !== original.total) {
      calls.push(fetch(`/api/companies/${activeCompanyId}/partners/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: editState.partnerId, field: "total", currentValue: original.total, newValue: newTotal }),
      }));
    }
    if (newLoan !== original.loan) {
      calls.push(fetch(`/api/companies/${activeCompanyId}/partners/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: editState.partnerId, field: "loan", currentValue: original.loan, newValue: newLoan }),
      }));
    }

    await Promise.all(calls);
    setEditState(null);
    fetchDashboard();
  };

  if (!activeCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">No company selected.</p>
        <Link href="/companies/new">
          <Button>Create a company</Button>
        </Link>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-24 animate-pulse bg-slate-100 rounded" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Current Balance",
      value: formatPKR(data.currentBalance),
      icon: Wallet,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "This Month Income",
      value: formatPKR(data.monthlyIncome),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "This Month Expense",
      value: formatPKR(data.monthlyExpense),
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Outstanding Loans",
      value: formatPKR(Math.abs(data.outstandingLoans)),
      icon: Landmark,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{activeCompany?.name}</h1>
          <p className="text-sm text-muted-foreground">Financial Overview</p>
        </div>
        <Link href="/transactions/new">
          <Button>+ Add Transaction</Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
                <div className={`${bg} p-2 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Partner Holdings */}
      {data.partnerHoldings.length > 0 && (() => {
        const totals = data.partnerHoldings.reduce(
          (acc, p) => ({ total: acc.total + p.total, loan: acc.loan + p.loan, holdings: acc.holdings + p.holdings }),
          { total: 0, loan: 0, holdings: 0 }
        );
        const myHolding = data.partnerHoldings.find((p) => p.id === session?.user?.id);
        const canEdit = session?.user?.role === "SUPER_ADMIN" || myHolding?.role === "ADMIN";

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> Partner Holdings
              </CardTitle>
              <Link href="/reports/partner" className="text-xs text-blue-600 hover:underline">Full report</Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-900 hover:bg-slate-900">
                    <TableHead className="text-white font-bold">Person</TableHead>
                    <TableHead className="text-right text-white font-bold">Total</TableHead>
                    <TableHead className="text-right text-white font-bold">Loan</TableHead>
                    <TableHead className="text-right text-white font-bold">Holdings</TableHead>
                    {canEdit && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.partnerHoldings.map((p) => {
                    const isEditing = editState?.partnerId === p.id;
                    const previewTotal = isEditing ? (parseFloat(editState.total) || 0) : p.total;
                    const previewHoldings = isEditing ? (parseFloat(editState.holdings) || 0) : p.holdings;
                    const previewLoan = previewTotal - previewHoldings; // Loan = Total - Holdings

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right text-sm">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="h-7 text-xs text-right w-36 ml-auto"
                              value={editState.total}
                              onChange={(e) => setEditState({ ...editState, total: e.target.value })}
                            />
                          ) : formatPKR(p.total)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-orange-600">
                          {formatPKR(previewLoan)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-green-700">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="h-7 text-xs text-right w-36 ml-auto"
                              value={editState.holdings}
                              onChange={(e) => setEditState({ ...editState, holdings: e.target.value })}
                            />
                          ) : formatPKR(p.holdings)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={handleSaveAdjustment}
                                  disabled={editState.saving}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setEditState(null)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                onClick={() => setEditState({ partnerId: p.id, total: String(p.total), holdings: String(p.holdings), saving: false })}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-green-800 hover:bg-green-800">
                    <TableCell className="text-white font-bold">Total</TableCell>
                    <TableCell className="text-right text-white font-bold">{formatPKR(totals.total)}</TableCell>
                    <TableCell className="text-right text-white font-bold">{formatPKR(totals.loan)}</TableCell>
                    <TableCell className="text-right text-white font-bold">{formatPKR(totals.holdings)}</TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      {/* Chart + Recent Transactions */}
      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Income vs Expense — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={data.chartData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/transactions" className="text-xs text-blue-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.recentTransactions.length === 0 && (
                <p className="text-sm text-muted-foreground p-4">No transactions yet.</p>
              )}
              {data.recentTransactions.map((tx) => {
                const isPositive = ["INCOME", "LOAN_RECEIVED"].includes(tx.type);
                return (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <Badge className={`text-xs ${TRANSACTION_TYPE_COLORS[tx.type]} border-0 mb-1`}>
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </Badge>
                      <p className="text-xs text-muted-foreground truncate">
                        {tx.description || tx.addedBy.name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className={`text-sm font-semibold flex items-center gap-0.5 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {formatPKR(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
