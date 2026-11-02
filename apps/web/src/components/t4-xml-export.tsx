"use client";

/**
 * Export T4 XML — collects the CRA T619 transmitter contact (name, area
 * code, phone, email), calls the exportT4Xml server action, and downloads
 * the returned XML client-side (same Blob pattern as remittance-actions).
 *
 * The email field is required: CRA's schema package 1-27-1 makes
 * <cntc_email_area> a required element of the T619 transmitter contact.
 */

import { useState } from "react";
import { Download, X } from "lucide-react";
import { exportT4Xml } from "@/lib/actions/t4";

type Props = { year: number };

const inputCls =
  "w-full rounded-[9px] border border-[#D6D3D1] px-3 py-2 text-sm outline-none focus:border-[#B3261E]";
const labelCls = "block text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] mb-1.5";

export function T4XmlExport({ year }: Props) {
  const [open, setOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    if (!email.trim()) {
      setError("Transmitter contact email is required — CRA's T619 requires it.");
      return;
    }
    setBusy(true);
    try {
      // W4-D7 — the action returns a discriminated result: expected
      // failures arrive as { ok: false, error } with the REAL reason
      // (a thrown action error is masked by Next.js in production).
      const result = await exportT4Xml(year, {
        contactName: contactName.trim(),
        areaCode: areaCode.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { filename, content } = result;
      const blob = new Blob([content], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "T4 XML export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-input bg-white px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
      >
        <Download className="h-4 w-4" /> Export T4 XML
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-[440px] rounded-[14px] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold">Export T4 XML · {year}</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  CRA Internet File Transfer (schema 1-27-1). The transmitter contact goes in the
                  T619 transmittal record.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#A8A29E] hover:text-[#1C1917]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5">
              <div>
                <label className={labelCls} htmlFor="t4-tx-name">Transmitter contact name</label>
                <input
                  id="t4-tx-name"
                  className={inputCls}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <div>
                  <label className={labelCls} htmlFor="t4-tx-area">Area code</label>
                  <input
                    id="t4-tx-area"
                    className={inputCls}
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    placeholder="403"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="t4-tx-phone">Phone</label>
                  <input
                    id="t4-tx-phone"
                    className={inputCls}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="555-1234"
                  />
                  <p className="text-xs text-[#A8A29E] mt-1">
                    7-digit local number — or paste the full 10-digit number and it will be split.
                  </p>
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="t4-tx-email">
                  Transmitter contact email *
                </label>
                <input
                  id="t4-tx-email"
                  type="email"
                  required
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
                <p className="text-xs text-[#A8A29E] mt-1">
                  Required — CRA&apos;s T619 transmittal record will not validate without it.
                </p>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-[9px] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 text-[13px] text-[#B3261E]">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setOpen(false)}
                className="rounded-[9px] border border-[#D6D3D1] bg-white px-4 py-2.5 text-[13px] font-semibold hover:border-[#B3261E] hover:text-[#B3261E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={busy}
                className="rounded-[9px] bg-[#B3261E] hover:bg-[#9B1C18] text-white px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "Building XML…" : "Download XML"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
