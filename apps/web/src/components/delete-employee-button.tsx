"use client";

import { deleteEmployee } from "@/lib/actions/employee";
import { Trash2 } from "lucide-react";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteEmployee} className="flex items-center justify-center">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-[#A8A29E] hover:text-[#B3261E] transition-colors p-1"
        title={`Delete ${name}`}
        onClick={(e) => { if (!confirm(`Delete ${name}?`)) e.preventDefault(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
