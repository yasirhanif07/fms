"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Landmark,
  FileBarChart2,
  Upload,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/import", label: "Import Data", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-slate-900 text-white min-h-screen">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">FMS</h1>
        <p className="text-xs text-slate-400 mt-1">Financial Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">PKR • v1.0</p>
      </div>
    </aside>
  );
}
