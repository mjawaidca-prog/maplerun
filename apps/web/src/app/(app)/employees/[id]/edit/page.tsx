/**
 * Edit employee — form pre-filled with existing data.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { updateEmployee } from "@/lib/actions/employee";
import { decrypt } from "@/lib/encryption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

type Props = { params: Promise<{ id: string }> };

export default async function EditEmployeePage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompany();

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { td1Profiles: { where: { year: 2026 }, take: 1 } },
  });
  if (!employee || employee.companyId !== companyId) notFound();

  const payGroups = await prisma.payGroup.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });

  const td1 = employee.td1Profiles[0];

  // Decrypt bank details
  let bankInfo = { transit: "", institution: "", account: "" };
  if (employee.bankEncrypted) {
    try { bankInfo = JSON.parse(decrypt(employee.bankEncrypted)); } catch {}
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/employees/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit {employee.firstName} {employee.lastName}</h1>
          <p className="text-muted-foreground mt-1">Update employee details, TD1, and payroll settings.</p>
        </div>
      </div>

      <form action={updateEmployee} className="space-y-8">
        <input type="hidden" name="id" value={employee.id} />

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Personal information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" name="firstName" required defaultValue={employee.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name *</Label>
                <Input id="lastName" name="lastName" required defaultValue={employee.lastName} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sin">SIN</Label>
              <Input id="sin" name="sin" placeholder="Leave blank to keep current" maxLength={11} />
              <p className="text-xs text-muted-foreground">Leave blank to keep the existing SIN.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={employee.phone ?? ""} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input id="addressLine1" name="addressLine1" defaultValue={employee.addressLine1 ?? ""} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={employee.city ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <select id="province" name="province" className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white" defaultValue={employee.province ?? "ON"}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input id="postalCode" name="postalCode" defaultValue={employee.postalCode ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provinceOfEmployment">Province of employment (payroll)</Label>
              <select id="provinceOfEmployment" name="provinceOfEmployment" className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white" defaultValue={employee.provinceOfEmployment ?? ""}>
                <option value="">Pay group default</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="text-[11px] text-[#A8A29E]">Where this employee&apos;s income is taxed for payroll. Leave on the pay-group default unless they work in a different province than the group.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Employment & pay</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={employee.startDate ? employee.startDate.toISOString().slice(0, 10) : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" defaultValue={employee.department ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={employee.dateOfBirth ? employee.dateOfBirth.toISOString().slice(0, 10) : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payGroupId">Pay group</Label>
                <select id="payGroupId" name="payGroupId" className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white" defaultValue={employee.payGroupId ?? ""}>
                  <option value="">Unassigned (in every run)</option>
                  {payGroups.map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payType">Pay type</Label>
                <select id="payType" name="payType" className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white" defaultValue={employee.payType ?? "salary"}>
                  <option value="salary">Salary</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payRate">Pay rate (per period)</Label>
                <Input id="payRate" name="payRate" type="number" min="0" step="0.01" defaultValue={employee.payRate ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vacationMode">Vacation pay</Label>
                <select id="vacationMode" name="vacationMode" className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white" defaultValue={employee.vacationMode}>
                  <option value="PAYOUT">Pay out each run</option>
                  <option value="ACCRUE">Accrue to a balance</option>
                  <option value="NONE">None</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vacationRatePct">Vacation rate %</Label>
                <Input id="vacationRatePct" name="vacationRatePct" type="number" min="0" step="0.1" defaultValue={employee.vacationRatePct ?? ""} />
              </div>
            </div>
            {employee.vacationMode === "ACCRUE" && (
              <p className="text-xs text-muted-foreground">Accrued vacation balance: ${(employee.vacationBalanceCents / 100).toFixed(2)} — grows with each finalized run; reversing a run unwinds its accrual.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Bank details (Direct Deposit)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankTransit">Transit # (5 digits)</Label>
                <Input id="bankTransit" name="bankTransit" defaultValue={bankInfo.transit} maxLength={5} pattern="\d{5}" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankInstitution">Institution # (3 digits)</Label>
                <Input id="bankInstitution" name="bankInstitution" defaultValue={bankInfo.institution} maxLength={3} pattern="\d{3}" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccount">Account #</Label>
                <Input id="bankAccount" name="bankAccount" defaultValue={bankInfo.account} maxLength={12} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Encrypted at rest. Used for CPA-005 direct deposit files.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">TD1 tax credits</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="federalClaim">Federal claim amount</Label>
                <Input id="federalClaim" name="federalClaim" type="number" step="0.01" defaultValue={td1?.federalClaim ?? ""} placeholder="Default BPA ($16,452)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincialClaim">Provincial claim amount</Label>
                <Input id="provincialClaim" name="provincialClaim" type="number" step="0.01" defaultValue={td1?.provincialClaim ?? ""} placeholder="Default provincial BPA" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="extraTaxPerPeriod">Extra tax/period</Label>
                <Input id="extraTaxPerPeriod" name="extraTaxPerPeriod" type="number" step="0.01" defaultValue={td1?.extraTaxPerPeriod ?? ""} placeholder="0.00" />
              </div>
              <div className="space-y-2 flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="cppExempt" value="true" defaultChecked={td1?.cppExempt ?? false} /> CPP exempt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="eiExempt" value="true" defaultChecked={td1?.eiExempt ?? false} /> EI exempt
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" size="lg">Save changes</Button>
          <Link href={`/employees/${id}`}>
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
