/**
 * Company settings — view and edit company details, pay groups, members.
 */

import { getCompany } from "@/lib/actions/company";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function CompanyPage() {
  const company = await getCompany();

  const roleLabel: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    VIEWER: "Viewer",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
        <p className="text-muted-foreground mt-1">Company settings and team.</p>
      </div>

      {/* Team members */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Team members</CardTitle>
          <CardDescription>
            {company.memberships.length} member{company.memberships.length !== 1 ? "s" : ""} with access to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {company.memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {m.user.name ?? m.user.email}
                </p>
                <p className="text-xs text-muted-foreground">{m.user.email}</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {roleLabel[m.role] ?? m.role}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pay groups */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Pay groups</CardTitle>
          <CardDescription>
            Configure payroll frequency and default province for groups of employees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {company.payGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pay groups configured.</p>
          ) : (
            <div className="space-y-2">
              {company.payGroups.map((pg) => (
                <div
                  key={pg.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-accent/30"
                >
                  <div>
                    <p className="text-sm font-medium">{pg.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pg.frequency.toLowerCase()} &middot; {pg.defaultProvince}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {pg.frequency.toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company details */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Company details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono text-xs">{company.id}</span>
          </div>
          <Separator />
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Slug</span>
            <span>{company.slug}</span>
          </div>
          <Separator />
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={company.active ? "default" : "secondary"} className="text-xs">
              {company.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
