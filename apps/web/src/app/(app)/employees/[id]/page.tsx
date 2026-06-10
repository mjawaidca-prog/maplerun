/**
 * Employee detail/edit page — view info, update TD1, terminate, edit.
 */

import { getEmployee, updateEmployee, terminateEmployee, updateTD1Profile } from "@/lib/actions/employee";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

function fmtCAD(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompany();

  let employee;
  try {
    employee = await getEmployee(id);
  } catch {
    notFound();
  }

  const payGroups = await prisma.payGroup.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });

  const td1 = employee.td1Profiles.find((p) => p.year === 2026);
  const ytd = employee.ytdLedgers[0];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/app/employees"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {employee.firstName} {employee.lastName}
            </h1>
            {!employee.active && (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            SIN encrypted &bull; {employee.email ?? "No email"}
          </p>
        </div>
      </div>

      {/* Edit personal info */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateEmployee} className="space-y-4">
            <input type="hidden" name="id" value={employee.id} />
            <input type="hidden" name="active" value={String(employee.active)} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={employee.firstName}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={employee.lastName}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sin">SIN (leave blank to keep current)</Label>
              <Input
                id="sin"
                name="sin"
                placeholder="•••••••••"
                maxLength={11}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={employee.email ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={employee.phone ?? ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={employee.city ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input
                  id="province"
                  name="province"
                  defaultValue={employee.province ?? ""}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={employee.postalCode ?? ""}
                  maxLength={7}
                />
              </div>
            </div>

            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* TD1 Profile */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">TD1 Profile (2026)</CardTitle>
          <CardDescription>
            Federal and provincial tax credit claims. Update if the employee
            submits a new TD1 form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateTD1Profile} className="space-y-4">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="year" value="2026" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="federalClaim">Federal TD1 claim</Label>
                <Input
                  id="federalClaim"
                  name="federalClaim"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Auto (BPA)"
                  defaultValue={td1?.federalClaim ?? ""}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincialClaim">Provincial TD1 claim</Label>
                <Input
                  id="provincialClaim"
                  name="provincialClaim"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Auto (provincial BPA)"
                  defaultValue={td1?.provincialClaim ?? ""}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extraTaxPerPeriod">Extra tax per period</Label>
              <Input
                id="extraTaxPerPeriod"
                name="extraTaxPerPeriod"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                defaultValue={td1?.extraTaxPerPeriod ?? ""}
                className="tabular-nums w-48"
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="cppExempt"
                  value="true"
                  defaultChecked={td1?.cppExempt}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">CPP exempt</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="eiExempt"
                  value="true"
                  defaultChecked={td1?.eiExempt}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">EI exempt</span>
              </label>
            </div>

            <Button type="submit" variant="outline">
              Update TD1
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* YTD snapshot */}
      {ytd && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Year-to-date (2026)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <YtdStat label="Pensionable earnings" value={fmtCAD(ytd.pensionableEarnings)} />
              <YtdStat label="CPP contributed" value={fmtCAD(ytd.cpp)} />
              <YtdStat label="CPP2 contributed" value={fmtCAD(ytd.cpp2)} />
              <YtdStat label="Insurable earnings" value={fmtCAD(ytd.insurableEarnings)} />
              <YtdStat label="EI contributed" value={fmtCAD(ytd.ei)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {employee.active && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              Terminate employee
            </CardTitle>
            <CardDescription>
              Marks the employee as inactive. They will no longer appear in pay runs.
              This does not delete any data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={terminateEmployee}>
              <input type="hidden" name="id" value={employee.id} />
              <Button type="submit" variant="destructive">
                Terminate employee
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function YtdStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
