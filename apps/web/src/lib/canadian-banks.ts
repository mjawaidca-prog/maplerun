/** Canadian financial institution codes for direct deposit. */
export const CANADIAN_BANKS = [
  { name: "Select bank...", institution: "", transit: "" },
  { name: "Royal Bank of Canada (RBC)", institution: "003", transit: "" },
  { name: "TD Canada Trust", institution: "004", transit: "" },
  { name: "Scotiabank", institution: "002", transit: "" },
  { name: "Bank of Montreal (BMO)", institution: "001", transit: "" },
  { name: "CIBC", institution: "010", transit: "" },
  { name: "National Bank of Canada", institution: "006", transit: "" },
  { name: "Desjardins", institution: "815", transit: "" },
  { name: "ATB Financial", institution: "219", transit: "" },
  { name: "HSBC Canada", institution: "016", transit: "" },
  { name: "Tangerine", institution: "614", transit: "" },
  { name: "Simplii Financial", institution: "010", transit: "" },
  { name: "Coast Capital Savings", institution: "809", transit: "" },
  { name: "Vancity", institution: "809", transit: "" },
  { name: "Meridian Credit Union", institution: "828", transit: "" },
  { name: "Laurentian Bank", institution: "039", transit: "" },
  { name: "Canadian Western Bank", institution: "030", transit: "" },
  { name: "Manulife Bank", institution: "540", transit: "" },
  { name: "EQ Bank", institution: "623", transit: "" },
  { name: "Other", institution: "", transit: "" },
];

export function getBank(institution: string) {
  return CANADIAN_BANKS.find(b => b.institution === institution) ?? CANADIAN_BANKS[0]!;
}
