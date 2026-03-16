"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

const ROLE_OPTIONS = ["ADMIN", "PARTNER", "VIEWER"];

export default function PartnersPage() {
  const { companyId } = useParams() as { companyId: string };
  const { data: session } = useSession();
  const [partners, setPartners] = useState<CompanyUser[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchPartners = async () => {
    const [pRes, cRes] = await Promise.all([
      fetch(`/api/companies/${companyId}/partners`),
      fetch(`/api/companies/${companyId}`),
    ]);
    if (pRes.ok) setPartners(await pRes.json());
    if (cRes.ok) { const c = await cRes.json(); setCompanyName(c.name); }
  };

  useEffect(() => { fetchPartners(); }, [companyId]);

  // Determine if current user can manage this company
  const myCompanyRole = partners.find((p) => p.user.id === session?.user?.id)?.role;
  const canManage =
    session?.user?.role === "SUPER_ADMIN" || myCompanyRole === "ADMIN";

  const handleRemove = async (partnerId: string) => {
    if (!confirm("Remove this partner?")) return;
    await fetch(`/api/companies/${companyId}/partners/${partnerId}`, { method: "DELETE" });
    fetchPartners();
  };

  const handleRoleChange = async (partnerId: string, newRole: string) => {
    setUpdatingId(partnerId);
    await fetch(`/api/companies/${companyId}/partners/${partnerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchPartners();
    setUpdatingId(null);
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
          {canManage && (
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
                <TableHead className="w-36">Role</TableHead>
                <TableHead>Joined</TableHead>
                {canManage && <TableHead className="w-10"></TableHead>}
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
                    {canManage && cu.user.id !== session?.user?.id ? (
                      <Select
                        value={cu.role}
                        onValueChange={(v) => v && handleRoleChange(cu.id, v)}
                        disabled={updatingId === cu.id}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`text-xs ${ROLE_COLORS[cu.role]} border-0`}>{cu.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(cu.joinedAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {cu.user.id !== session?.user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleRemove(cu.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
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
