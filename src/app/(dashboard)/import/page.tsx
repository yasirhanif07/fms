"use client";

import { useCallback, useRef, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { parseCSV, type ParsedTransaction } from "@/lib/csvImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/lib/constants";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import Link from "next/link";

type Step = "upload" | "preview" | "done";

const TYPE_OPTIONS = Object.entries(TRANSACTION_TYPE_LABELS);
const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS);

export default function ImportPage() {
  const { activeCompanyId, activeCompany, companies, setActiveCompanyId } = useCompany();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompanyId || "");

  const handleFile = useCallback((file: File) => {
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
  }, []);

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

  const updateTx = (index: number, field: keyof ParsedTransaction, value: string) => {
    setTransactions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "type" && value !== "EXPENSE") {
        updated[index].category = null;
      }
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
        })),
      }),
    });

    setImporting(false);

    if (!res.ok) {
      const d = await res.json();
      setImportError(d.error || "Import failed");
    } else {
      const d = await res.json();
      setImportedCount(d.imported);
      setStep("done");
    }
  };

  // ── Step: Upload ──────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Import Historical Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your CSV ledger file to bulk-import transactions
          </p>
        </div>

        {/* Company selector */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm font-medium">Import into company</p>
            <Select
              value={selectedCompanyId}
              onValueChange={(v) => { if (v) { setSelectedCompanyId(v); setActiveCompanyId(v); } }}
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
          </CardContent>
        </Card>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <p className="text-base font-medium text-slate-700">
            Drop your CSV file here
          </p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          <p className="text-xs text-muted-foreground mt-3">
            Supported format: CSV (.csv) — same structure as your Excel ledger sheet
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Format guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Expected CSV format</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Column A: Date (e.g. 1-Nov-2024 or 01-Jan-2025)</p>
            <p>Column B: Income amount (leave blank if expense)</p>
            <p>Column C: Expense amount (leave blank if income)</p>
            <p>Column D: Description</p>
            <p className="pt-2 text-slate-500">
              Rows with no date or no amount are automatically skipped.
              Transaction types are auto-detected from descriptions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Step: Done ────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="max-w-lg flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h1 className="text-2xl font-bold">Import Complete</h1>
        <p className="text-muted-foreground text-center">
          Successfully imported <span className="font-semibold text-green-600">{importedCount} transactions</span> into{" "}
          <span className="font-semibold">{companies.find(c => c.id === selectedCompanyId)?.name}</span>
        </p>
        <div className="flex gap-3 mt-4">
          <Link href="/transactions">
            <Button>View Transactions</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
          <Button variant="outline" onClick={() => { setStep("upload"); setTransactions([]); }}>
            Import Another
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Preview ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Preview Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and edit before importing. Remove any rows you don&apos;t want.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setTransactions([]); }}>
          ← Upload Different File
        </Button>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          <span><strong>{transactions.length}</strong> transactions ready</span>
        </div>
        {skipped > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-sm px-3 py-1.5 rounded-lg">
            <span><strong>{skipped}</strong> rows skipped (empty/summary)</span>
          </div>
        )}
        {parseErrors.length > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 text-sm px-3 py-1.5 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span><strong>{parseErrors.length}</strong> parse errors</span>
          </div>
        )}
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-orange-800 mb-2">Rows with parse errors (skipped):</p>
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-orange-700">{e}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead className="w-44">Type</TableHead>
                  <TableHead className="w-44">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-36">Amount (PKR)</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {tx.dateStr}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.type}
                        onValueChange={(v) => v && updateTx(i, "type", v)}
                      >
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
                    <TableCell className="text-sm max-w-[260px] truncate" title={tx.description}>
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {formatPKR(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => removeTx(i)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
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

      {/* Import action */}
      <div className="flex items-center gap-4 pt-2">
        <Button
          onClick={handleImport}
          disabled={importing || transactions.length === 0}
          size="lg"
        >
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
