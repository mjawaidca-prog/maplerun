import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import type { PayrollGuide } from "@/lib/guides";

export function GuideCard({ guide }: { guide: PayrollGuide }) {
  return (
    <article className="flex h-full flex-col rounded-[14px] border border-[#E7E5E4] bg-white p-6">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[#B3261E]">
        <BookOpenCheck size={15} /> {guide.category}
      </span>
      <h3 className="mt-4 text-xl font-bold leading-snug text-[#1C1917]">
        <Link href={`/guides/${guide.slug}`} className="no-underline hover:text-[#B3261E]">
          {guide.title}
        </Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-[#57534E]">{guide.description}</p>
      <Link
        href={`/guides/${guide.slug}`}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#B3261E] no-underline"
      >
        Read the guide <ArrowRight size={15} />
      </Link>
    </article>
  );
}
