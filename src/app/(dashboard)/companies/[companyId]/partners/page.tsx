"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface CompanyUser {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string };
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-800",
  PARTNER: "bg-green-100 text-green-800",
  VIEWER: "bg-slate-100 text-slate-600",
};

export default function PartnersPage() {
  const { companyId } = useParams() as { companyId: string };
  const { data: session } = useSession();
  const [partners, setPartners] = useState<CompanyUser[]>([]);
  const [companyName, setCompanyName] = useState("");

  const fetchPartners = async () => {
    const [pRes, cRes] = await Promise.all([
      fetch(`/api/companies/${companyId}/partners`),
      fetch(`/api/companies/${companyId}`),
    ]);
    if (pRes.ok) setPartners(await pRes.json());
    if (cRes.ok) { const c = await cRes.json(); setCompanyName(c.name); }
  };

  useEffect(() => { fetchPartners(); }, [companyId]);

  const handleRemove = async (partnerId: string) => {
    if (!confirm("Remove this partner?")) return;
    await fetch(`/api/companies/${companyId}/partners/${partnerId}`, { method: "DELETE" });
    fetchPartners();
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to Companies
        </Link>
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">Partners</h1>
            <p className="text-sm text-muted-foreground">{companyName}</p>
          </div>
          {session?.user.role === "ADMIN" && (
            <Link href={`/companies/${companyId}/partners/new`}>
              <Button><Plus className="w-4 h-4 mr-1" /> Add Partner</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {session?.user.role === "ADMIN" && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No partners yet.
                  </TableCell>
                </TableRow>
              )}
              {partners.map((cu) => (
                <TableRow key={cu.id}>
                  <TableCell className="font-medium">{cu.user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cu.user.email}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${ROLE_COLORS[cu.role]} border-0`}>{cu.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(cu.joinedAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  {session?.user.role === "ADMIN" && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleRemove(cu.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
