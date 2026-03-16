"use client";

import { useCallback, useRef, useState } from "react";
import { useCompany } from "@/context/CompanyContext";
import { parseCSV, detectPartner, type ParsedTransaction, type PartnerSummary } from "@/lib/csvImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/currency";
import {
  TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS,
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/constants";
import { Upload, CheckCircle2, AlertCircle, X, User } from "lucide-react";
import Link from "next/link";

type Step = "upload" | "preview" | "done";

interface Partner {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}

const TYPE_OPTIONS = Object.entries(TRANSACTION_TYPE_LABELS);
const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS);

export default function ImportPage() {
  const { activeCompanyId, companies, setActiveCompanyId } = useCompany();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerSummary, setPartnerSummary] = useState<PartnerSummary[]>([]);
  // mapping: csv name → partner userId (for base values)
  const [summaryMapping, setSummaryMapping] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompanyId || "");

  // Fetch partners whenever company changes
  const fetchPartners = async (companyId: string) => {
    const res = await fetch(`/api/companies/${companyId}/partners`);
    if (res.ok) {
      const data: Partner[] = await res.json();
      setPartners(data);
      return data;
    }
    return [];
  };

  const handleCompanyChange = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveCompanyId(companyId);
    await fetchPartners(companyId);
  };

  const handleFile = useCallback(
    async (file: File) => {
      // Make sure partners are loaded
      let currentPartners = partners;
      if (!currentPartners.length && selectedCompanyId) {
        currentPartners = await fetchPartners(selectedCompanyId);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { transactions: txs, partnerSummary: ps, skipped: sk, errors } = parseCSV(text);

        // Auto-detect partner name from description
        const partnerNames = currentPartners.map((p) => p.user.name);
        const partnerByName = Object.fromEntries(
          currentPartners.map((p) => [p.user.name.toLowerCase(), p.user.id])
        );
        const partnerByFirstName = Object.fromEntries(
          currentPartners.map((p) => [p.user.name.split(" ")[0].toLowerCase(), p.user.id])
        );

        const resolved = txs.map((tx) => {
          const detected = detectPartner(tx.description, partnerNames);
          let addedById: string | null = null;
          if (detected) {
            addedById =
              partnerByName[detected.toLowerCase()] ||
              partnerByFirstName[detected.split(" ")[0].toLowerCase()] ||
              null;
          }
          return { ...tx, detectedPartnerName: detected, addedById };
        });

        // Auto-map partner summary names to partner IDs
        const mapping: Record<string, string> = {};
        ps.forEach((s) => {
          const id =
            partnerByName[s.name.toLowerCase()] ||
            partnerByFirstName[s.name.split(" ")[0].toLowerCase()] ||
            "";
          mapping[s.name] = id;
        });

        setTransactions(resolved);
        setPartnerSummary(ps);
        setSummaryMapping(mapping);
        setSkipped(sk);
        setParseErrors(errors);
        setStep("preview");
      };
      reader.readAsText(file);
    },
    [partners, selectedCompanyId]
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

    // 1. Import transactions
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

    // 2. Save partner base values if summary was detected and mapped
    const baseRows = partnerSummary
      .filter((s) => summaryMapping[s.name])
      .map((s) => ({
        userId: summaryMapping[s.name],
        baseHoldings: s.holdings,
        baseLoan: s.loan,
      }));

    if (baseRows.length > 0) {
      await fetch(`/api/companies/${selectedCompanyId}/partners/base`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: baseRows }),
      });
    }

    setImporting(false);
    setImportedCount(imported);
    setStep("done");
  };

  // Count how many were auto-detected
  const detectedCount = transactions.filter((tx) => tx.addedById).length;
  const unassignedCount = transactions.filter((tx) => !tx.addedById).length;

  // ── Upload ────────────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Import Historical Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your CSV ledger file to bulk-import transactions
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm font-medium">Import into company</p>
            <Select
              value={selectedCompanyId}
              onValueChange={(v) => v && handleCompanyChange(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company first" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {partners.length > 0 && (
              <p className="text-xs text-green-600">
                ✓ {partners.length} partners loaded — names will be auto-detected from descriptions
              </p>
            )}
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
              Partner names are auto-matched from descriptions. Types and categories are auto-detected.
              Everything is editable in the preview before import.
            </p>
          </CardContent>
        </Card>
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
          <Button variant="outline" onClick={() => { setStep("upload"); setTransactions([]); }}>
            Import Another
          </Button>
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
            Review and edit before importing. The <strong>Added By</strong> column is auto-detected from descriptions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setTransactions([]); setPartnerSummary([]); setSummaryMapping({}); }}>
          ← Different File
        </Button>
      </div>

      {/* Partner Holdings Summary from CSV */}
      {partnerSummary.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-blue-800">
              Partner Holdings detected in CSV — will be set as base values
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-blue-700 border-b border-blue-200">
                  <th className="text-left pb-1">Person (CSV)</th>
                  <th className="text-right pb-1">Loan</th>
                  <th className="text-right pb-1">Holdings</th>
                  <th className="text-right pb-1">Total</th>
                  <th className="text-right pb-1">Mapped to</th>
                </tr>
              </thead>
              <tbody>
                {partnerSummary.map((s) => (
                  <tr key={s.name} className="border-b border-blue-100 last:border-0">
                    <td className="py-1 font-medium">{s.name}</td>
                    <td className="text-right text-orange-600">{formatPKR(s.loan)}</td>
                    <td className="text-right text-green-700">{formatPKR(s.holdings)}</td>
                    <td className="text-right font-semibold">{formatPKR(s.total)}</td>
                    <td className="text-right">
                      <Select
                        value={summaryMapping[s.name] || "NONE"}
                        onValueChange={(v) => v && setSummaryMapping({ ...summaryMapping, [s.name]: v === "NONE" ? "" : v })}
                      >
                        <SelectTrigger className="h-6 text-xs w-36 ml-auto">
                          <SelectValue placeholder="— skip —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE" className="text-xs text-muted-foreground">— skip —</SelectItem>
                          {partners.map((p) => (
                            <SelectItem key={p.user.id} value={p.user.id} className="text-xs">{p.user.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          <span><strong>{transactions.length}</strong> transactions ready</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-lg">
          <User className="w-4 h-4" />
          <span><strong>{detectedCount}</strong> partners auto-detected</span>
        </div>
        {unassignedCount > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 text-sm px-3 py-1.5 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span><strong>{unassignedCount}</strong> unassigned — will use your account</span>
          </div>
        )}
        {skipped > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-sm px-3 py-1.5 rounded-lg">
            <span><strong>{skipped}</strong> rows skipped</span>
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
                  <TableRow key={i} className={!tx.addedById ? "bg-orange-50/40" : ""}>
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
                        <SelectTrigger className={`h-7 text-xs ${!tx.addedById ? "border-orange-300 text-orange-600" : ""}`}>
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
