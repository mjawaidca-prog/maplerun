/**
 * New payee page — server component wrapper.
 */

import { requireCompany } from "@/lib/session";
import { PayeeForm } from "@/components/payee-form";

export default async function NewPayeePage() {
  await requireCompany();
  return <PayeeForm />;
}
