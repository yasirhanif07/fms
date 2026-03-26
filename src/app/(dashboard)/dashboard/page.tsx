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
  Trash2,
  Plus,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from "@/lib/constants";

interface PartnerLoanEntry {
  id: string;
  amount: number;
  description: string | null;
  date: string;
}

interface PartnerHolding {
  id: string;
  name: string;
  role: string;
  baseHoldings: number;
  baseLoan: number;
  holdings: number;
  loan: number;
  loanTxDelta: number;
  loans: PartnerLoanEntry[];
  total: number;
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

// rows: { partnerId, loan, holdings } — Total is auto-computed as Loan + Holdings
type EditRows = Record<string, { loan: string; holdings: string }>;

export default function DashboardPage() {
  const { activeCompanyId, activeCompany } = useCompany();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editRows, setEditRows] = useState<EditRows>({});
  const [saving, setSaving] = useState(false);

  // Loans panel state
  const [expandedLoanPartnerId, setExpandedLoanPartnerId] = useState<string | null>(null);
  const [newLoan, setNewLoan] = useState<{ amount: string; description: string; date: string }>({
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanDeleting, setLoanDeleting] = useState<string | null>(null);

  const fetchDashboard = () => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetch(`/api/dashboard?companyId=${activeCompanyId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, [activeCompanyId]);

  const startEditing = (holdings: PartnerHolding[]) => {
    const rows: EditRows = {};
    holdings.forEach((p) => {
      rows[p.id] = { loan: String(p.loan), holdings: String(p.holdings) };
    });
    setEditRows(rows);
    setEditing(true);
  };

  const handleSaveAll = async () => {
    if (!activeCompanyId || !data) return;
    setSaving(true);

    const rows = data.partnerHoldings.map((p) => {
      const row = editRows[p.id] ?? { loan: String(p.loan), holdings: String(p.holdings) };
      const txDelta = p.holdings - p.baseHoldings; // holdings change from transactions
      const partnerLoansSum = p.loans.reduce((s, l) => s + l.amount, 0);
      const inputHoldings = parseFloat(row.holdings) || 0;
      const inputLoan = parseFloat(row.loan) || 0;
      return {
        userId: p.id,
        baseHoldings: inputHoldings - txDelta,
        baseLoan: inputLoan - partnerLoansSum - p.loanTxDelta,
      };
    });

    await fetch(`/api/companies/${activeCompanyId}/partners/base`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });

    setSaving(false);
    setEditing(false);
    fetchDashboard();
  };

  const handleAddLoan = async (userId: string) => {
    if (!activeCompanyId) return;
    const amount = parseFloat(newLoan.amount);
    if (!amount || amount <= 0) return;
    setLoanSaving(true);
    await fetch(`/api/companies/${activeCompanyId}/partners/${userId}/loans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        description: newLoan.description || null,
        date: newLoan.date ? new Date(newLoan.date).toISOString() : undefined,
      }),
    });
    setLoanSaving(false);
    setNewLoan({ amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
    fetchDashboard();
  };

  const handleDeleteLoan = async (userId: string, loanId: string) => {
    if (!activeCompanyId) return;
    setLoanDeleting(loanId);
    await fetch(`/api/companies/${activeCompanyId}/partners/${userId}/loans?loanId=${loanId}`, {
      method: "DELETE",
    });
    setLoanDeleting(null);
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
        const myHolding = data.partnerHoldings.find((p) => p.id === session?.user?.id);
        const canEdit = session?.user?.role === "SUPER_ADMIN" || myHolding?.role === "ADMIN";

        // Live preview rows (use editRows when editing, else original)
        const previewRows = data.partnerHoldings.map((p) => {
          if (!editing) return { ...p };
          const row = editRows[p.id] ?? { loan: String(p.loan), holdings: String(p.holdings) };
          const holdings = parseFloat(row.holdings) || 0;
          const loan = parseFloat(row.loan) || 0;
          return { ...p, loan, holdings, total: holdings + loan };
        });

        const totals = previewRows.reduce(
          (acc, p) => ({ total: acc.total + p.total, loan: acc.loan + p.loan, holdings: acc.holdings + p.holdings }),
          { total: 0, loan: 0, holdings: 0 }
        );

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> Partner Holdings
              </CardTitle>
              <div className="flex items-center gap-2">
                {canEdit && !editing && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => startEditing(data.partnerHoldings)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                )}
                {editing && (
                  <>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveAll} disabled={saving}>
                      <Check className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(false)} disabled={saving}>
                      <X className="w-3 h-3" /> Cancel
                    </Button>
                  </>
                )}
                <Link href="/reports/partner" className="text-xs text-blue-600 hover:underline">Full report</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-900 hover:bg-slate-900">
                    <TableHead className="text-white font-bold">Person</TableHead>
                    <TableHead className="text-right text-white font-bold">Loan</TableHead>
                    <TableHead className="text-right text-white font-bold">Holdings</TableHead>
                    <TableHead className="text-right text-white font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.partnerHoldings.map((p) => {
                    const row = editRows[p.id] ?? { loan: String(p.loan), holdings: String(p.holdings) };
                    const preview = previewRows.find((r) => r.id === p.id)!;
                    const isLoanExpanded = expandedLoanPartnerId === p.id;
                    return (
                      <>
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right text-sm text-orange-600">
                            {editing ? (
                              <Input
                                type="number"
                                className="h-7 text-xs text-right w-36 ml-auto"
                                value={row.loan}
                                onChange={(e) => setEditRows({ ...editRows, [p.id]: { ...row, loan: e.target.value } })}
                              />
                            ) : (
                              <button
                                className="hover:underline cursor-pointer"
                                onClick={() => {
                                  setExpandedLoanPartnerId(isLoanExpanded ? null : p.id);
                                  setNewLoan({ amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
                                }}
                              >
                                {formatPKR(p.loan)}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-green-700">
                            {editing ? (
                              <Input
                                type="number"
                                className="h-7 text-xs text-right w-36 ml-auto"
                                value={row.holdings}
                                onChange={(e) => setEditRows({ ...editRows, [p.id]: { ...row, holdings: e.target.value } })}
                              />
                            ) : formatPKR(p.holdings)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {formatPKR(preview.total)}
                          </TableCell>
                        </TableRow>
                        {isLoanExpanded && (
                          <TableRow key={`${p.id}-loans`} className="bg-orange-50/60">
                            <TableCell colSpan={4} className="py-3 px-4">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                                  Loans for {p.name}
                                </p>
                                {p.loans.length === 0 && (
                                  <p className="text-xs text-muted-foreground">No loans recorded yet.</p>
                                )}
                                {p.loans.map((l) => (
                                  <div key={l.id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-2 border border-orange-100">
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-orange-700">{formatPKR(l.amount)}</span>
                                      <span className="text-muted-foreground">{l.description || "—"}</span>
                                      <span className="text-muted-foreground">
                                        {new Date(l.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                    </div>
                                    {canEdit && (
                                      <button
                                        className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                        disabled={loanDeleting === l.id}
                                        onClick={() => handleDeleteLoan(p.id, l.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {canEdit && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <Input
                                      type="number"
                                      placeholder="Amount"
                                      className="h-7 text-xs w-28"
                                      value={newLoan.amount}
                                      onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                                    />
                                    <Input
                                      type="text"
                                      placeholder="Description"
                                      className="h-7 text-xs flex-1"
                                      value={newLoan.description}
                                      onChange={(e) => setNewLoan({ ...newLoan, description: e.target.value })}
                                    />
                                    <Input
                                      type="date"
                                      className="h-7 text-xs w-36"
                                      value={newLoan.date}
                                      onChange={(e) => setNewLoan({ ...newLoan, date: e.target.value })}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      disabled={loanSaving || !newLoan.amount}
                                      onClick={() => handleAddLoan(p.id)}
                                    >
                                      <Plus className="w-3 h-3" /> {loanSaving ? "Adding..." : "Add"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  <TableRow className="bg-green-800 hover:bg-green-800">
                    <TableCell className="text-white font-bold">Total</TableCell>
                    <TableCell className="text-right text-white font-bold">{formatPKR(totals.loan)}</TableCell>
                    <TableCell className="text-right text-white font-bold">{formatPKR(totals.holdings)}</TableCell>
                    <TableCell className="text-right text-white font-bold">{formatPKR(totals.total)}</TableCell>
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
