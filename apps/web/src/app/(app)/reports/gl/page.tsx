/**
 * GL Journal — debit/credit journal entries from finalized pay runs.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function GlJournalPage() {
  const { companyId } = await requireCompany();

  const runs = await prisma.payRun.findMany({
    where: { companyId, status: "FINALIZED" },
    include: { payGroup: { select: { name: true } } },
    orderBy: { payDate: "desc" },
    take: 10,
  });

  // Build GL entries per run
  const journals = runs.map((run) => {
    const wageExpense = run.totalGross; // DEBIT
    const cppPayable = run.totalCpp + run.totalEmployerCpp; // CREDIT
    const cpp2Payable = run.totalCpp2 + run.totalEmployerCpp2;
    const eiPayable = run.totalEi + run.totalEmployerEi;
    const taxPayable = run.totalFederalTax + run.totalProvincialTax; // CREDIT
    const netCash = run.totalNetPay; // CREDIT
    const totalCredit = cppPayable + cpp2Payable + eiPayable + taxPayable + netCash;

    return {
      id: run.id,
      date: run.payDate,
      payGroup: run.payGroup.name,
      entries: [
        { account: "Wages & Salaries Expense", debit: wageExpense, credit: 0 },
        { account: "CPP Payable (CRA)", debit: 0, credit: cppPayable },
        { account: "CPP2 Payable (CRA)", debit: 0, credit: cpp2Payable },
        { account: "EI Payable (CRA)", debit: 0, credit: eiPayable },
        { account: "Income Tax Payable (CRA)", debit: 0, credit: taxPayable },
        { account: "Net Pay — Cash", debit: 0, credit: netCash },
      ].filter((e) => Math.abs(e.debit) > 0.005 || Math.abs(e.credit) > 0.005),
      totalDebit: wageExpense,
      totalCredit,
    };
  });

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › GL Journal
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">GL Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Debit/credit journal entries from finalized pay runs — ready for your accounting software.
          </p>
        </div>
      </div>

      {journals.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No journal entries yet</p>
          <p className="text-[13px] text-muted-foreground mt-1">Finalize pay runs to generate GL journal entries.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {journals.map((j) => (
            <div key={j.id} className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="bg-[#1C1917] text-white px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">{j.date}</span>
                  <span className="text-xs text-[#A8A29E]">{j.payGroup}</span>
                </div>
                <span className="text-xs text-[#78716C]">Journal Entry #{j.id.slice(-6)}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
                    <th className="text-left px-5 py-2.5">Account</th>
                    <th className="text-right px-5 py-2.5 w-[140px]">Debit</th>
                    <th className="text-right px-5 py-2.5 w-[140px]">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {j.entries.map((e) => (
                    <tr key={e.account} className="border-b border-[#F0EFED] last:border-b-0 text-[13px]">
                      <td className="px-5 py-3">{e.account}</td>
                      <td className="text-right px-5 py-3 font-mono tabular-nums">{e.debit > 0 ? fmtCAD(e.debit) : ""}</td>
                      <td className="text-right px-5 py-3 font-mono tabular-nums">{e.credit > 0 ? fmtCAD(e.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1C1917] text-white font-bold text-[13px]">
                    <td className="px-5 py-3">Total</td>
                    <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(j.totalDebit)}</td>
                    <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(j.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
            ℹ️ Each pay run produces standard journal entries. Debits = Credits always. Export to CSV for QuickBooks, Xero, or your accounting software.
          </div>
        </div>
      )}
    </div>
  );
}
