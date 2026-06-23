"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "SEMIMONTHLY", label: "Semi-monthly" },
  { value: "MONTHLY", label: "Monthly" },
];

interface PayGroup {
  id: string;
  name: string;
  frequency: string;
  defaultProvince: string;
}

interface Props {
  companyId: string;
  payGroups: PayGroup[];
}

export function PayGroupsManager({ companyId, payGroups: initialGroups }: Props) {
  const router = useRouter();
  const [payGroups, setPayGroups] = useState<PayGroup[]>(initialGroups);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("BIWEEKLY");
  const [defaultProvince, setDefaultProvince] = useState("ON");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Pay group name is required."); return; }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/pay-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name: name.trim(), frequency, defaultProvince }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create pay group");
      }
      const created = await res.json();
      setPayGroups([...payGroups, created.payGroup]);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this pay group? Employees assigned to it will need to be reassigned.")) return;
    try {
      const res = await fetch(`/api/pay-groups?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to delete pay group");
      }
      setPayGroups(payGroups.filter((pg) => pg.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-[22px] py-[18px] border-b border-[#F0EFED]">
          <span className="text-base font-bold">Create pay group</span>
        </div>
        <form onSubmit={handleCreate} className="p-[22px] space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#78716C] block mb-1.5">Group name <span className="text-[#B3261E]">*</span></label>
              <input
                className="w-full border border-[#D6D3D1] rounded-lg px-3 py-[10px] text-sm bg-white font-sans disabled:opacity-50"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                disabled={creating}
                placeholder="e.g. Hourly Staff"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#78716C] block mb-1.5">Pay frequency <span className="text-[#B3261E]">*</span></label>
              <select
                className="w-full border border-[#D6D3D1] rounded-lg px-3 py-[10px] text-sm bg-white font-sans disabled:opacity-50"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                disabled={creating}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#78716C] block mb-1.5">Default province <span className="text-[#B3261E]">*</span></label>
              <select
                className="w-full border border-[#D6D3D1] rounded-lg px-3 py-[10px] text-sm bg-white font-sans disabled:opacity-50"
                value={defaultProvince}
                onChange={(e) => setDefaultProvince(e.target.value)}
                disabled={creating}
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[13px] font-semibold px-5 py-2.5 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "+ Create pay group"}
          </button>
        </form>
      </div>

      {/* Existing pay groups */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-[22px] py-[18px] border-b border-[#F0EFED] flex justify-between items-center">
          <span className="text-base font-bold">Your pay groups</span>
          <span className="text-xs text-[#A8A29E]">{payGroups.length} group{payGroups.length !== 1 ? "s" : ""}</span>
        </div>

        {payGroups.length === 0 ? (
          <div className="p-[22px] text-center">
            <p className="text-sm text-[#A8A29E]">No pay groups yet. Create one above to start running payroll.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EFED]">
            {payGroups.map((pg) => (
              <div key={pg.id} className="flex items-center justify-between px-[22px] py-4">
                <div>
                  <p className="text-sm font-bold text-[#1C1917]">{pg.name}</p>
                  <p className="text-xs text-[#A8A29E] mt-0.5">
                    {FREQUENCIES.find((f) => f.value === pg.frequency)?.label ?? pg.frequency} · Default province: {pg.defaultProvince}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-full px-2.5 py-1">
                    {FREQUENCIES.find((f) => f.value === pg.frequency)?.label ?? pg.frequency}
                  </span>
                  <button
                    onClick={() => handleDelete(pg.id)}
                    className="text-[#A8A29E] hover:text-[#B3261E] text-sm ml-2 cursor-pointer"
                    title="Delete pay group"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
