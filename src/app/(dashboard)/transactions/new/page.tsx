"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRANSACTION_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const TYPES = Object.entries(TRANSACTION_TYPE_LABELS);
const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS);

interface Partner {
  id: string;
  user: { id: string; name: string };
}

export default function NewTransactionPage() {
  const router = useRouter();
  const { activeCompanyId, companies, setActiveCompanyId } = useCompany();

  const [form, setForm] = useState({
    companyId: activeCompanyId || "",
    type: "",
    category: "",
    loanDirection: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    addedById: "",
    loanRecipientId: "",
  });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch partners whenever company changes
  useEffect(() => {
    if (!form.companyId) return;
    fetch(`/api/companies/${form.companyId}/partners`)
      .then((r) => r.json())
      .then((data: Partner[]) => {
        setPartners(data);
        setForm((prev) => ({ ...prev, addedById: "" }));
      });
  }, [form.companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyId || !form.type || !form.amount || !form.date) {
      setError("Please fill all required fields");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        category: form.type === "EXPENSE" ? form.category || null : null,
        loanDirection: form.type === "LOAN_REPAYMENT" ? form.loanDirection || null : null,
        addedById: form.addedById || null,
        loanRecipientId: form.type === "LOAN_GIVEN" ? form.loanRecipientId || null : null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create transaction");
    } else {
      router.push("/transactions");
    }
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/transactions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to Transactions
        </Link>
        <h1 className="text-2xl font-bold mt-3">New Transaction</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company */}
            <div className="space-y-1.5">
              <Label>Company *</Label>
              <Select
                value={form.companyId}
                onValueChange={(v) => { if (v) { setForm({ ...form, companyId: v }); setActiveCompanyId(v); } }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Added By */}
            {partners.length > 0 && (
              <div className="space-y-1.5">
                <Label>Added By</Label>
                <Select
                  value={form.addedById}
                  onValueChange={(v) => v && setForm({ ...form, addedById: v === "SELF" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— me (default) —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELF">— me (default) —</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.user.id} value={p.user.id}>{p.user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Transaction Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => v && setForm({ ...form, type: v, category: "", loanDirection: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category — only for EXPENSE */}
            {form.type === "EXPENSE" && (
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Loan Recipient — only for LOAN_GIVEN */}
            {form.type === "LOAN_GIVEN" && partners.length > 0 && (
              <div className="space-y-1.5">
                <Label>Loan Recipient (Partner)</Label>
                <Select
                  value={form.loanRecipientId}
                  onValueChange={(v) => v && setForm({ ...form, loanRecipientId: v === "NONE" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— select who receives the loan —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">— external / no partner —</SelectItem>
                    {partners
                      .filter((p) => p.user.id !== form.addedById)
                      .map((p) => (
                        <SelectItem key={p.user.id} value={p.user.id}>{p.user.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Giver&apos;s holdings will decrease. Recipient&apos;s loan will increase.
                </p>
              </div>
            )}

            {/* Loan direction — only for LOAN_REPAYMENT */}
            {form.type === "LOAN_REPAYMENT" && (
              <div className="space-y-1.5">
                <Label>Repayment Direction *</Label>
                <Select value={form.loanDirection} onValueChange={(v) => v && setForm({ ...form, loanDirection: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFLOW">Inflow — We received repayment</SelectItem>
                    <SelectItem value="OUTFLOW">Outflow — We repaid a loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>Amount (PKR) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">PKR</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  className="pl-12"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional note or detail"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Save Transaction"}
              </Button>
              <Link href="/transactions">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
