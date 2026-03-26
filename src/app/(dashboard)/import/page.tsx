"use client";

import { useCallback, useRef, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { parseCSV, type ParsedTransaction } from "@/lib/csvImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import {
  TRANSACTION_TYPE_LABELS, EXPENSE_CATEGORY_LABELS,
} from "@/lib/constants";
import { Upload, CheckCircle2, AlertCircle, X } from "lucide-react";
import Link from "next/link";

type Step = "upload" | "preview" | "partner-setup" | "done";

interface Partner {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
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
  loans: { id: string; amount: number; description: string; date: string }[];
}

type SetupRows = Record<string, { holdings: string; loan: string }>;

const TYPE_OPTIONS = Object.entries(TRANSACTION_TYPE_LABELS);
const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS);

export default function ImportPage() {
  const { activeCompanyId, companies, setActiveCompanyId } = useCompany();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompanyId || "");
  const [partnerHoldings, setPartnerHoldings] = useState<PartnerHolding[]>([]);
  const [setupRows, setSetupRows] = useState<SetupRows>({});
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState("");

  const fetchPartners = async (companyId: string) => {
    const res = await fetch(`/api/companies/${companyId}/partners`);
    if (res.ok) {
      const data: Partner[] = await res.json();
      setPartners(data);
    }
  };

  const handleCompanyChange = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveCompanyId(companyId);
    await fetchPartners(companyId);
  };

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { transactions: txs, skipped: sk, errors } = parseCSV(text);
        setTransactions(txs);
        setSkipped(sk);
        setParseErrors(errors);
        setStep("preview");
      };
      reader.readAsText(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const updateTx = (index: number, field: keyof ParsedTransaction, value: string | null) => {
    setTransactions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "type" && value !== "EXPENSE") updated[index].category = null;
      return updated;
    });
  };

  const removeTx = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!selectedCompanyId) { setImportError("Select a company"); return; }
    if (transactions.length === 0) { setImportError("No transactions to import"); return; }

    setImporting(true);
    setImportError("");

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedCompanyId,
        transactions: transactions.map((tx) => ({
          date: tx.date.toISOString(),
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          description: tx.description,
          addedById: tx.addedById || "",
        })),
      }),
    });

    if (!res.ok) {
      setImporting(false);
      setImportError((await res.json()).error || "Import failed");
      return;
    }

    const { imported } = await res.json();
    setImporting(false);
    setImportedCount(imported);

    // Fetch partner data for setup step
    const dashRes = await fetch(`/api/dashboard?companyId=${selectedCompanyId}`);
    if (dashRes.ok) {
      const dashData = await dashRes.json();
      setPartnerHoldings(dashData.partnerHoldings);
      const rows: SetupRows = {};
      dashData.partnerHoldings.forEach((p: PartnerHolding) => {
        rows[p.id] = { holdings: String(p.holdings), loan: String(p.loan) };
      });
      setSetupRows(rows);
    }
    setStep("partner-setup");
  };

  const handleSaveSetup = async () => {
    setSetupSaving(true);
    setSetupError("");

    const rows = partnerHoldings.map((p) => {
      const row = setupRows[p.id] ?? { holdings: String(p.holdings), loan: String(p.loan) };
      const txDelta = p.holdings - p.baseHoldings;
      const partnerLoansSum = p.loans.reduce((s, l) => s + l.amount, 0);
      return {
        userId: p.id,
        baseHoldings: (parseFloat(row.holdings) || 0) - txDelta,
        baseLoan: (parseFloat(row.loan) || 0) - partnerLoansSum - p.loanTxDelta,
      };
    });

    const res = await fetch(`/api/companies/${selectedCompanyId}/partners/base`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });

    setSetupSaving(false);
    if (!res.ok) {
      setSetupError((await res.json()).error || "Save failed");
      return;
    }
    setStep("done");
  };

  const reset = () => {
    setStep("upload");
    setTransactions([]);
    setSkipped(0);
    setParseErrors([]);
    setImportError("");
    setSetupError("");
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Import Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV file to bulk-import transactions
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm font-medium">Import into company</p>
            <Select value={selectedCompanyId} onValueChange={(v) => v && handleCompanyChange(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select company first" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <p className="text-base font-medium text-slate-700">Drop your CSV file here</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Expected CSV format</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Column A: Date (e.g. 1-Nov-2024 or 01-Jan-2025)</p>
            <p>Column B: Income amount</p>
            <p>Column C: Expense amount</p>
            <p>Column D: Description</p>
            <p className="pt-2 text-slate-500">
              Income column → Income. Expense column → Expense. Type and category can be adjusted in the preview.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Partner Setup ─────────────────────────────────────────────────────────
  if (step === "partner-setup") {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Set Partner Holdings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter current holdings and loan for each partner. Skip to set later from the dashboard.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg w-fit">
          <CheckCircle2 className="w-4 h-4" />
          <span><strong>{importedCount}</strong> transactions imported</span>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="w-44">Holdings (PKR)</TableHead>
                  <TableHead className="w-44">Loan (PKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerHoldings.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.role}</div>
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={setupRows[p.id]?.holdings ?? "0"}
                        onChange={(e) =>
                          setSetupRows((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], holdings: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={setupRows[p.id]?.loan ?? "0"}
                        onChange={(e) =>
                          setSetupRows((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], loan: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSaveSetup} disabled={setupSaving}>
            {setupSaving ? "Saving..." : "Save & Finish"}
          </Button>
          <Button variant="outline" onClick={() => setStep("done")}>
            Skip
          </Button>
          {setupError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {setupError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="max-w-lg flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h1 className="text-2xl font-bold">Import Complete</h1>
        <p className="text-muted-foreground text-center">
          Successfully imported{" "}
          <span className="font-semibold text-green-600">{importedCount} transactions</span> into{" "}
          <span className="font-semibold">{companies.find((c) => c.id === selectedCompanyId)?.name}</span>
        </p>
        <div className="flex gap-3 mt-4">
          <Link href="/transactions"><Button>View Transactions</Button></Link>
          <Link href="/dashboard"><Button variant="outline">Dashboard</Button></Link>
          <Button variant="outline" onClick={reset}>Import Another</Button>
        </div>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Preview Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and edit before importing.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>← Different File</Button>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          <span><strong>{transactions.length}</strong> transactions ready</span>
        </div>
        {skipped > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-sm px-3 py-1.5 rounded-lg">
            <span><strong>{skipped}</strong> rows skipped</span>
          </div>
        )}
        {parseErrors.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-sm px-3 py-1.5 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span><strong>{parseErrors.length}</strong> parse errors</span>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-40">Type</TableHead>
                  <TableHead className="w-40">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-36">Added By</TableHead>
                  <TableHead className="text-right w-32">Amount</TableHead>
                  <TableHead className="w-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {tx.dateStr}
                    </TableCell>
                    <TableCell>
                      <Select value={tx.type} onValueChange={(v) => v && updateTx(i, "type", v)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {tx.type === "EXPENSE" ? (
                        <Select
                          value={tx.category || "OTHER"}
                          onValueChange={(v) => v && updateTx(i, "category", v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={tx.description}>
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.addedById || "UNASSIGNED"}
                        onValueChange={(v) => updateTx(i, "addedById", v === "UNASSIGNED" ? null : v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="— unassigned —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNASSIGNED" className="text-xs text-muted-foreground">
                            — unassigned —
                          </SelectItem>
                          {partners.map((p) => (
                            <SelectItem key={p.user.id} value={p.user.id} className="text-xs">
                              {p.user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {formatPKR(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => removeTx(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 pt-2">
        <Button onClick={handleImport} disabled={importing || transactions.length === 0} size="lg">
          {importing
            ? `Importing ${transactions.length} transactions...`
            : `Import ${transactions.length} Transactions`}
        </Button>
        {importError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {importError}
          </p>
        )}
      </div>
    </div>
  );
}
