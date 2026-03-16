import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart3, Users } from "lucide-react";

const REPORTS = [
  {
    href: "/reports/monthly",
    title: "Monthly Report",
    desc: "Income, expenses, and transactions for a selected month",
    icon: Calendar,
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/reports/overall",
    title: "Overall Summary",
    desc: "All-time financial summary broken down by month",
    icon: BarChart3,
    color: "bg-green-50 text-green-600",
  },
  {
    href: "/reports/partner",
    title: "Partner Report",
    desc: "Transaction contributions by each partner",
    icon: Users,
    color: "bg-orange-50 text-orange-600",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(({ href, title, desc, icon: Icon, color }) => (
          <Card key={href} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} mb-2`}>
                <Icon className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardHeader>
            <CardContent>
              <Link href={href}>
                <Button variant="outline" className="w-full">View Report</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
