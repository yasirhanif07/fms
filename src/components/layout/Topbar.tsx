"use client";

import { signOut, useSession } from "next-auth/react";
import { useCompany } from "@/context/CompanyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut, Building2 } from "lucide-react";
import Link from "next/link";

export function Topbar() {
  const { data: session } = useSession();
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany();

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="font-bold text-slate-900 lg:hidden">FMS</span>

        {companies.length > 0 && (
          <Select
            value={activeCompanyId || ""}
            onValueChange={(v) => v && setActiveCompanyId(v)}
          >
            <SelectTrigger className="w-48 h-8 text-sm">
              <Building2 className="w-3.5 h-3.5 mr-1" />
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {companies.length === 0 && session?.user.role === "ADMIN" && (
          <Link href="/companies/new">
            <Button size="sm" variant="outline" className="h-8 text-sm">
              + Create Company
            </Button>
          </Link>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
              {session?.user.name?.[0]?.toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm">{session?.user.name}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{session?.user.name}</p>
            <p className="text-xs text-muted-foreground">{session?.user.role}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link href="/companies" className="flex items-center gap-2 w-full">
              <Building2 className="w-4 h-4" />
              Companies
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 gap-2 cursor-pointer"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
