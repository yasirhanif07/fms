"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, UserPlus, Users } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
}

type Mode = "existing" | "new";

export default function AddPartnerPage() {
  const router = useRouter();
  const { companyId } = useParams() as { companyId: string };

  const [mode, setMode] = useState<Mode>("existing");
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Existing user fields
  const [userId, setUserId] = useState("");

  // New user fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [role, setRole] = useState("PARTNER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ isNewUser: boolean; tempPassword: string | null; name: string } | null>(null);

  useEffect(() => {
    // Fetch all users and current company partners, show only those NOT already in company
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch(`/api/companies/${companyId}/partners`).then((r) => r.json()),
    ]).then(([allUsers, currentPartners]) => {
      const partnerUserIds = new Set(currentPartners.map((p: any) => p.user.id));
      setAvailableUsers(allUsers.filter((u: User) => !partnerUserIds.has(u.id)));
    });
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let body: Record<string, string>;

    if (mode === "existing") {
      if (!userId) { setError("Select a user"); return; }
      const selected = availableUsers.find((u) => u.id === userId);
      if (!selected) { setError("User not found"); return; }
      body = { name: selected.name, email: selected.email, role };
    } else {
      if (!name.trim() || !email.trim()) { setError("Name and email are required"); return; }
      body = { name: name.trim(), email: email.trim().toLowerCase(), role };
    }

    setLoading(true);
    const res = await fetch(`/api/companies/${companyId}/partners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);

    if (!res.ok) { setError((await res.json()).error || "Failed"); return; }
    const data = await res.json();

    if (data.isNewUser) {
      setDone({ isNewUser: true, tempPassword: data.tempPassword, name: data.user.name });
    } else {
      router.push(`/companies/${companyId}/partners`);
    }
  };

  if (done) {
    return (
      <div className="max-w-lg">
        <div className="mb-6">
          <Link href={`/companies/${companyId}/partners`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back to Partners
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">{done.name} added as partner</p>
                <p className="text-sm text-muted-foreground">A new account was created for them.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">Share these login credentials:</p>
              <div className="flex items-center justify-between bg-white rounded px-3 py-2 border">
                <span className="text-sm font-mono text-slate-700">Password: <strong>{done.tempPassword}</strong></span>
                <button
                  onClick={() => navigator.clipboard.writeText(done.tempPassword || "")}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-amber-700">Ask them to change their password after first login.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => router.push(`/companies/${companyId}/partners`)} className="flex-1">Done</Button>
              <Button variant="outline" onClick={() => { setDone(null); setName(""); setEmail(""); setUserId(""); }}>
                Add Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href={`/companies/${companyId}/partners`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold mt-3">Add Partner</h1>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode("existing"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
            mode === "existing" ? "bg-slate-900 text-white border-slate-900" : "text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          <Users className="w-4 h-4" /> Existing User
        </button>
        <button
          onClick={() => { setMode("new"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
            mode === "new" ? "bg-slate-900 text-white border-slate-900" : "text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          <UserPlus className="w-4 h-4" /> New Person
        </button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "existing" ? (
              <div className="space-y-1.5">
                <Label>Select User *</Label>
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">All registered users are already in this company.</p>
                ) : (
                  <Select value={userId} onValueChange={(v) => v && setUserId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a registered user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} — {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input placeholder="e.g. Yasir Hanif" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="e.g. yasir@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="PARTNER">Partner</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || (mode === "existing" && availableUsers.length === 0)} className="flex-1">
                {loading ? "Adding..." : "Add Partner"}
              </Button>
              <Link href={`/companies/${companyId}/partners`}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
