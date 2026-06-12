"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";

export function StubBackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to pay run
    </Link>
  );
}

export function StubPdfLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[10px] border border-input bg-white px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
    >
      <Download className="h-4 w-4" /> PDF
    </Link>
  );
}

export function StubPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-[10px] border border-input bg-white px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
    >
      <Printer className="h-4 w-4" /> Print
    </button>
  );
}
