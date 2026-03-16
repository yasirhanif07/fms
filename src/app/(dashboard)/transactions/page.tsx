"use client";

import { useEffect, useState, useCallback } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_COLORS,
  EXPENSE_CATEGORY_LABELS,
  getBalanceDelta,
} from "@/lib/constants";
import Link from "next/link";
import { Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";

interface Transaction {
  id: string;
  type: string;
  category: string | null;
  amount: number;
  description: string | null;
  date: string;
  runningBalance: number;
  addedBy: { name: string };
}

const TYPE_OPTIONS = [
  { value: "ALL", label: "All Types" },
  ...Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
];

export default function TransactionsPage() {
  const { activeCompanyId } = useCompany();
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTxs = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const params = new URLSearchParams({ companyId: activeCompanyId, page: String(page), limit: "20" });
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    const res = await fetch(`/api/transactions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    }
    setLoading(false);
  }, [activeCompanyId, page, typeFilter]);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTxs();
  };

  const filtered = search
    ? transactions.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(search.toLowerCase()) ||
          tx.addedBy.name.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  const totalPages = Math.ceil(total / 20);

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Link href="/transactions/new">
          <Button><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by description or partner..."
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={typeFilter} onValueChange={(v) => { if (v) { setTypeFilter(v); setPage(1); } }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                  {session?.user.role === "ADMIN" && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((tx) => {
                  const delta = getBalanceDelta(tx.type);
                  const isPositive = delta > 0;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString("en-PK", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${TRANSACTION_TYPE_COLORS[tx.type]} border-0`}>
                          {TRANSACTION_TYPE_LABELS[tx.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.category ? EXPENSE_CATEGORY_LABELS[tx.category] : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{tx.addedBy.name}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                        {isPositive ? "+" : "−"}{formatPKR(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatPKR(tx.runningBalance)}
                      </TableCell>
                      {session?.user.role === "ADMIN" && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                            onClick={() => handleDelete(tx.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {total} total transactions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
