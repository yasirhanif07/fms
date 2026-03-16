"use client";

import { useEffect, useState, useCallback } from "react";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
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
import { Trash2, Plus, ChevronLeft, ChevronRight, Pencil, X, Check } from "lucide-react";
import { useSession } from "next-auth/react";

interface Transaction {
  id: string;
  type: string;
  category: string | null;
  loanDirection: string | null;
  amount: number;
  description: string | null;
  date: string;
  runningBalance: number;
  addedBy: { id: string; name: string };
}

interface Partner {
  id: string;
  user: { id: string; name: string };
}

const TYPE_OPTIONS = [
  { value: "ALL", label: "All Types" },
  ...Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
];

const TYPES = Object.entries(TRANSACTION_TYPE_LABELS);
const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS);

interface EditForm {
  type: string;
  category: string;
  loanDirection: string;
  amount: string;
  description: string;
  date: string;
  addedById: string;
}

export default function TransactionsPage() {
  const { activeCompanyId } = useCompany();
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    type: "",
    category: "",
    loanDirection: "",
    amount: "",
    description: "",
    date: "",
    addedById: "",
  });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const isAdmin =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";

  const fetchTxs = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const params = new URLSearchParams({
      companyId: activeCompanyId,
      page: String(page),
      limit: "20",
    });
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    const res = await fetch(`/api/transactions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    }
    setLoading(false);
  }, [activeCompanyId, page, typeFilter]);

  useEffect(() => {
    fetchTxs();
  }, [fetchTxs]);

  // Fetch partners once for the edit dropdown
  useEffect(() => {
    if (!activeCompanyId || !isAdmin) return;
    fetch(`/api/companies/${activeCompanyId}/partners`)
      .then((r) => r.json())
      .then((data: Partner[]) => setPartners(data));
  }, [activeCompanyId, isAdmin]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTxs();
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditError("");
    setEditForm({
      type: tx.type,
      category: tx.category || "",
      loanDirection: tx.loanDirection || "",
      amount: String(tx.amount),
      description: tx.description || "",
      date: tx.date.split("T")[0],
      addedById: tx.addedBy.id,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
  };

  const handleSave = async () => {
    if (!editingId) return;
    setEditSaving(true);
    setEditError("");
    const res = await fetch(`/api/transactions/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editForm.type,
        category: editForm.type === "EXPENSE" ? editForm.category || null : null,
        loanDirection:
          editForm.type === "LOAN_REPAYMENT" ? editForm.loanDirection || null : null,
        amount: parseFloat(editForm.amount),
        description: editForm.description || null,
        date: editForm.date,
        addedById: editForm.addedById || null,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditingId(null);
      fetchTxs();
    } else {
      const d = await res.json();
      setEditError(d.error || "Failed to save");
    }
  };

  const filtered = search
    ? transactions.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(search.toLowerCase()) ||
          tx.addedBy.name.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  const totalPages = Math.ceil(total / 20);
  const colSpan = isAdmin ? 9 : 7;

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
          <Button>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
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
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            if (v) {
              setTypeFilter(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
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
                  {isAdmin && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No transactions found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((tx) => {
                  const delta = getBalanceDelta(tx.type);
                  const isPositive = delta > 0;
                  const isEditing = editingId === tx.id;

                  return (
                    <>
                      <TableRow key={tx.id} className={isEditing ? "bg-muted/30" : undefined}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString("en-PK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${TRANSACTION_TYPE_COLORS[tx.type]} border-0`}
                          >
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
                        <TableCell
                          className={`text-right text-sm font-semibold ${
                            isPositive ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isPositive ? "+" : "−"}
                          {formatPKR(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatPKR(tx.runningBalance)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              {isEditing ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-slate-700 h-7 w-7 p-0"
                                  onClick={cancelEdit}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-500 hover:text-blue-700 h-7 w-7 p-0"
                                    onClick={() => startEdit(tx)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                                    onClick={() => handleDelete(tx.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>

                      {/* Inline edit row */}
                      {isEditing && (
                        <TableRow key={`${tx.id}-edit`} className="bg-muted/20">
                          <TableCell colSpan={colSpan} className="py-3 px-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                              {/* Date */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Date</label>
                                <Input
                                  type="date"
                                  value={editForm.date}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, date: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>

                              {/* Type */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Type</label>
                                <Select
                                  value={editForm.type}
                                  onValueChange={(v) =>
                                    v &&
                                    setEditForm({
                                      ...editForm,
                                      type: v,
                                      category: "",
                                      loanDirection: "",
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TYPES.map(([k, v]) => (
                                      <SelectItem key={k} value={k}>
                                        {v}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Category — EXPENSE only */}
                              {editForm.type === "EXPENSE" && (
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Category
                                  </label>
                                  <Select
                                    value={editForm.category}
                                    onValueChange={(v) =>
                                      v && setEditForm({ ...editForm, category: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CATEGORIES.map(([k, v]) => (
                                        <SelectItem key={k} value={k}>
                                          {v}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Loan direction — LOAN_REPAYMENT only */}
                              {editForm.type === "LOAN_REPAYMENT" && (
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Direction
                                  </label>
                                  <Select
                                    value={editForm.loanDirection}
                                    onValueChange={(v) =>
                                      v && setEditForm({ ...editForm, loanDirection: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="INFLOW">Inflow — We received</SelectItem>
                                      <SelectItem value="OUTFLOW">Outflow — We repaid</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Amount */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Amount</label>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={editForm.amount}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, amount: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>

                              {/* Description */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Description
                                </label>
                                <Input
                                  value={editForm.description}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, description: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                  placeholder="Optional"
                                />
                              </div>

                              {/* Added By */}
                              {partners.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Added By
                                  </label>
                                  <Select
                                    value={editForm.addedById}
                                    onValueChange={(v) =>
                                      v && setEditForm({ ...editForm, addedById: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {partners.map((p) => (
                                        <SelectItem key={p.user.id} value={p.user.id}>
                                          {p.user.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            {editError && (
                              <p className="text-xs text-red-600 mt-2">{editError}</p>
                            )}

                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={editSaving}
                                className="h-8"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {editSaving ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                className="h-8"
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">{total} total transactions</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
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
