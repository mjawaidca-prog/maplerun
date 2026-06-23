import Link from "next/link";

interface TrialBannerProps {
  trialEndsAt: Date | null;
  plan: string;
}

/**
 * Shows a "X days left in your free trial" banner for any company with an active trial.
 * Hidden only for promo users (no trialEndsAt) and expired trials.
 */
export function TrialBanner({ trialEndsAt, plan }: TrialBannerProps) {
  // No trial set (promo code) — don't show
  if (!trialEndsAt) return null;

  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Trial expired — don't show (the pay-run gate handles the block)
  if (daysLeft <= 0) return null;

  const urgent = daysLeft <= 3;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-3 rounded-xl text-sm font-medium ${
        urgent
          ? "bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]"
          : "bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]"
      }`}
    >
      <span>
        {urgent
          ? `⚠️ Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — upgrade to keep running payroll.`
          : `🎉 ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.`}
      </span>
      <Link
        href="/company?tab=billing"
        className={`inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13px] font-semibold no-underline whitespace-nowrap transition-colors ${
          urgent
            ? "bg-[#B3261E] text-white hover:bg-[#8F1D17]"
            : "bg-[#1E40AF] text-white hover:bg-[#1E3A8A]"
        }`}
      >
        Upgrade plan →
      </Link>
    </div>
  );
}
