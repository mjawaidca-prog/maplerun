/**
 * Employee portal — outer shell (Wave 3, A4).
 *
 * Deliberately separate from the employer (app) shell: employees are not
 * employer users. Authentication is Clerk (via the identity seam); the
 * (home) route-group layout enforces it. This layout is chrome only.
 */

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <header className="bg-white border-b border-[#E7E5E4]">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-[#1C1917]">Nexvar Pay</p>
            <p className="text-xs text-[#A8A29E]">Employee portal</p>
          </div>
          <span className="text-xs text-[#78716C]">A NexvarLab product</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-6">{children}</main>
    </div>
  );
}
