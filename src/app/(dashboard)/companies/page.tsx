"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Building2, Plus, Users, Trash2, Settings } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";

interface Company {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  companyUsers: { id: string; role: string; user: { name: string; email: string } }[];
}

export default function CompaniesPage() {
  const { data: session } = useSession();
  const { refreshCompanies } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch("/api/companies");
    if (res.ok) setCompanies(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this company and all its data? This cannot be undone.")) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    fetch_();
    refreshCompanies();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        {session?.user.role === "ADMIN" && (
          <Link href="/companies/new">
            <Button><Plus className="w-4 h-4 mr-1" /> New Company</Button>
          </Link>
        )}
      </div>

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6 h-32 animate-pulse bg-slate-100 rounded" /></Card>
          ))}
        </div>
      )}

      {!loading && companies.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 border rounded-xl bg-white">
          <Building2 className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">No companies yet.</p>
          {session?.user.role === "ADMIN" && (
            <Link href="/companies/new"><Button size="sm">Create Company</Button></Link>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                  {c.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>
                  )}
                </div>
                {session?.user.role === "ADMIN" && (
                  <div className="flex gap-1 ml-2">
                    <Link href={`/companies/${c.id}/edit`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                <Users className="w-3.5 h-3.5" />
                {c.companyUsers.length} partner{c.companyUsers.length !== 1 ? "s" : ""}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {c.companyUsers.slice(0, 3).map((cu) => (
                  <Badge key={cu.id} variant="secondary" className="text-xs">{cu.user.name}</Badge>
                ))}
                {c.companyUsers.length > 3 && (
                  <Badge variant="secondary" className="text-xs">+{c.companyUsers.length - 3}</Badge>
                )}
              </div>
              <Link href={`/companies/${c.id}/partners`}>
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Manage Partners
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
