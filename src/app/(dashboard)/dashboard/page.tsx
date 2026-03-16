"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IncomeExpenseChart } from "@/components/dashboard/IncomeExpenseChart";
import { formatPKR } from "@/lib/currency";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from "@/lib/constants";

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
}

export default function DashboardPage() {
  const { activeCompanyId, activeCompany } = useCompany();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetch(`/api/dashboard?companyId=${activeCompanyId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [activeCompanyId]);

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
