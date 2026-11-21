/**
 * T4A CRA XML export form (server component — a plain GET form).
 *
 * The filing details CRA requires (payer RP account, payer address,
 * contact) are NOT stored on the company record, so they are collected
 * here and passed to /api/t4a/xml as query parameters — nothing is
 * fabricated. The RP account field is prefilled from the company's
 * 9-digit business number + "RP0001" when one is on file; it stays
 * editable because the account suffix is the filer's to confirm.
 */

export function T4aXmlExportForm({
  year,
  defaultPayerBn15,
  companyName,
}: {
  year: number;
  defaultPayerBn15?: string;
  companyName: string;
}) {
  const field =
    "rounded-[9px] border border-[#E7E5E4] px-3 py-2 text-[13px] w-full bg-white outline-none focus:border-[#B3261E]";
  const label = "block text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] mb-1.5";

  return (
    <form action="/api/t4a" method="GET" className="space-y-4">
      <input type="hidden" name="year" value={year} />
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label} htmlFor="payerBn15">Payer RP account (BN15) *</label>
          <input id="payerBn15" name="payerBn15" required defaultValue={defaultPayerBn15 ?? ""} placeholder="123456789RP0001" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="transmitterName">Transmitter name</label>
          <input id="transmitterName" name="transmitterName" defaultValue={companyName} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="payerCity">Payer city</label>
          <input id="payerCity" name="payerCity" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="payerAddressLine1">Payer address line 1</label>
          <input id="payerAddressLine1" name="payerAddressLine1" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="payerProvince">Payer province</label>
          <input id="payerProvince" name="payerProvince" placeholder="AB" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="payerPostalCode">Payer postal code</label>
          <input id="payerPostalCode" name="payerPostalCode" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="contactName">Contact name *</label>
          <input id="contactName" name="contactName" required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="contactPhone">Contact phone *</label>
          <div className="flex gap-2">
            <input name="contactAreaCode" required placeholder="403" className={`${field} w-20`} aria-label="Contact area code" />
            <input id="contactPhone" name="contactPhone" required placeholder="555-1234" className={field} />
            <input name="contactExt" placeholder="Ext" className={`${field} w-20`} aria-label="Contact extension" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="contactEmail">Contact email *</label>
          <input id="contactEmail" name="contactEmail" type="email" required className={field} />
        </div>
      </div>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-[10px] bg-[#1C1917] hover:bg-black text-white text-sm font-semibold px-5 py-2.5 transition-colors"
      >
        Download T4A XML ({year})
      </button>
      <p className="text-xs text-[#A8A29E]">
        The file is generated only if the summary ties to the slips and every slip computes cleanly.
        File it through CRA Internet File Transfer / Represent a Client, then keep the confirmation with your records.
      </p>
    </form>
  );
}
