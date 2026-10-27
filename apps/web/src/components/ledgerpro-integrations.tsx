"use client";

/**
 * Integrations tab — LedgerPro connection management (M6).
 *
 * Connect form (base URL + API key password field; the key is stored
 * AES-256-GCM encrypted server-side and NEVER rendered back), test
 * connection, mapping-mode selector + account-mapping editor, sync
 * enable toggle (default OFF), and disconnect.
 */

import { useState } from "react";
import { saveLedgerProConnection, disconnectLedgerPro } from "@/lib/actions/ledgerpro";
import { DEFAULT_MAPPING, type LedgerProMapping, type MappingMode } from "@/lib/ledgerpro-journal";
import {
  connectionFingerprint,
  formStateFromConnection,
  type LedgerProConnectionView,
} from "@/lib/ledgerpro-form-state";

export type ConnectionView = LedgerProConnectionView;

type Props = {
  companyId: string;
  connection: ConnectionView | null;
};

const MODE1_FIELDS: { key: keyof LedgerProMapping; label: string }[] = [
  { key: "mode1Expense", label: "Payroll expense (Dr)" },
  { key: "mode1RemittancePayable", label: "Source deductions payable (Cr)" },
  { key: "mode1NetPayPayable", label: "Net pay payable (Cr)" },
];

const MODE2_FIELDS: { key: keyof LedgerProMapping; label: string }[] = [
  { key: "wagesExpense", label: "Wages & salaries expense (Dr)" },
  { key: "employerCppExpense", label: "Employer CPP expense (Dr)" },
  { key: "employerCpp2Expense", label: "Employer CPP2 expense (Dr)" },
  { key: "employerEiExpense", label: "Employer EI expense (Dr)" },
  { key: "cppPayable", label: "CPP payable (Cr)" },
  { key: "cpp2Payable", label: "CPP2 payable (Cr)" },
  { key: "eiPayable", label: "EI payable (Cr)" },
  { key: "incomeTaxPayable", label: "Income tax payable (Cr)" },
  { key: "wagesPayable", label: "Wages / net pay payable (Cr)" },
];

const inputCls = "w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans disabled:opacity-50";
const labelCls = "text-xs font-semibold text-[#78716C] block mb-1.5";

export function LedgerProIntegrations({ companyId, connection }: Props) {
  const [form, setForm] = useState(() => formStateFromConnection(connection));
  const { baseUrl, mode, mapping, syncEnabled } = form;
  const setBaseUrl = (v: string) => setForm((f) => ({ ...f, baseUrl: v }));
  const setMode = (v: MappingMode) => setForm((f) => ({ ...f, mode: v }));
  const setMapping = (v: LedgerProMapping) => setForm((f) => ({ ...f, mapping: v }));
  const setSyncEnabled = (v: boolean) => setForm((f) => ({ ...f, syncEnabled: v }));
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Re-sync the form from the SAVED connection whenever it changes (a
  // save landed, or the connection was disconnected). The saved record is
  // what a finalize-time sync reads, so the form must reflect it — before
  // this, mount-time state lived forever and the displayed mode could
  // disagree with the persisted one until some unrelated re-render.
  // (React's "adjust state when a prop changes" pattern: setState during
  // render re-renders immediately, before anything commits.)
  const savedFingerprint = connectionFingerprint(connection);
  const [syncedFingerprint, setSyncedFingerprint] = useState(savedFingerprint);
  if (syncedFingerprint !== savedFingerprint) {
    setSyncedFingerprint(savedFingerprint);
    setForm(formStateFromConnection(connection));
    setApiKey("");
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/ledgerpro/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, baseUrl, apiKey: apiKey || undefined, mappingMode: mode, mapping }),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: Boolean(data.ok),
        message: data.message ?? data.error ?? "Test failed.",
      });
    } catch {
      setTestResult({ ok: false, message: "Could not run the test — network error." });
    } finally {
      setTesting(false);
    }
  }

  function mappingInputs(fields: { key: keyof LedgerProMapping; label: string }[]) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <input
              name={`map_${key}`}
              className={inputCls}
              value={mapping[key]}
              onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
              placeholder={DEFAULT_MAPPING[key]}
              maxLength={20}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-[22px] py-[18px] border-b border-[#F0EFED] flex justify-between items-center">
          <span className="text-base font-bold">LedgerPro</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-[11px] py-1.5 border ${connection ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]" : "bg-[#F5F5F4] border-[#E7E5E4] text-[#78716C]"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connection ? "bg-[#4ADE80]" : "bg-[#D6D3D1]"}`} />
            {connection ? "Connected" : "Not connected"}
          </span>
        </div>

        <form action={saveLedgerProConnection} className="p-[22px] space-y-5">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Post each finalized pay run to LedgerPro as one aggregate journal. In LedgerPro, go to
            Settings → Developer, enable API access, and create a key named e.g. “Nexvar Pay” with
            <strong> write_posting + read</strong> permissions, then paste it here. The key is stored
            encrypted and is never shown again.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>LedgerPro base URL</label>
              <input name="baseUrl" className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>API key {connection?.hasKey && <span className="font-normal">(stored — leave blank to keep it)</span>}</label>
              <input
                name="apiKey"
                type="password"
                className={inputCls}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={connection?.hasKey ? "••••••••••••••••" : "lp_live_…"}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="rounded-[9px] border border-[#D6D3D1] bg-white px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testResult && (
              <span className={`text-[13px] font-medium ${testResult.ok ? "text-[#15803D]" : "text-[#B3261E]"}`}>
                {testResult.ok ? "✓ " : "✗ "}{testResult.message}
              </span>
            )}
          </div>

          <div className="border-t border-[#F0EFED] pt-5 space-y-4">
            <div>
              <label className={labelCls}>Account mapping mode</label>
              <select
                name="mappingMode"
                className={`${inputCls} max-w-xs`}
                value={mode}
                onChange={(e) => setMode(e.target.value as MappingMode)}
              >
                <option value="MODE1">Mode 1 — Simple (LedgerPro template accounts only)</option>
                <option value="MODE2">Mode 2 — Granular (separate CPP / EI / tax / wages payables)</option>
              </select>
            </div>

            {mode === "MODE1" ? mappingInputs(MODE1_FIELDS) : mappingInputs(MODE2_FIELDS)}
            {/* Keep the inactive mode's values in the form so switching back doesn't lose them. */}
            {(mode === "MODE1" ? MODE2_FIELDS : MODE1_FIELDS).map(({ key }) => (
              <input key={key} type="hidden" name={`map_${key}`} value={mapping[key]} readOnly />
            ))}
            <p className="text-xs text-[#A8A29E] leading-relaxed">
              Codes are LedgerPro chart-of-accounts codes. Mode 2 defaults use the payroll accounts
              LedgerPro adds to its chart (2410 CPP, 2420 EI, 2430 Income Tax, 2440 Wages Payable,
              6940 Employer Payroll Taxes). “Test connection” checks every mapped code exists and is active.
            </p>
          </div>

          <div className="border-t border-[#F0EFED] pt-5 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="syncEnabled"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-semibold block">Sync pay runs to LedgerPro</span>
                <span className="text-[13px] text-muted-foreground leading-relaxed block">
                  Finalizing a pay run posts its journal to LedgerPro immediately — there is no draft
                  step in LedgerPro, so review the pay-run preview carefully before finalizing.
                  Leave this off until you have tested the connection.
                </span>
              </span>
            </label>
          </div>

          <div className="flex gap-2.5">
            <button type="submit" className="rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white px-5 py-2.5 text-[13px] font-semibold transition-colors">
              Save integration
            </button>
          </div>
        </form>

        {connection && (
          <div className="px-[22px] pb-[22px]">
            <form
              action={disconnectLedgerPro}
              onSubmit={(e) => { if (!confirm("Disconnect LedgerPro? The stored API key will be deleted. Past sync records stay, but no new pay runs will post.")) e.preventDefault(); }}
            >
              <button type="submit" className="text-[13px] font-semibold text-[#B3261E] hover:text-[#8F1D17]">
                Disconnect LedgerPro
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
