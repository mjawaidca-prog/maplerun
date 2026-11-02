// @vitest-environment jsdom
/**
 * ReversePayRunButton — client wiring regression test.
 *
 * The original component gated the form submit on the native
 * `window.confirm()` dialog inside the button's onClick. In any
 * browsing context where that dialog cannot be displayed (embedded
 * or sandboxed frames without allow-modals, dialog-suppressing
 * automation), `confirm()` returns false instantly, the handler
 * calls preventDefault(), and the button renders but NEVER fires —
 * no dialog, no error, no state change (the production bug this
 * test guards). jsdom does not implement window.confirm either, so
 * the old component fails this suite for the same reason.
 *
 * The server action itself is mocked: this test exercises only the
 * click → in-page confirmation → submit path, plus the exact
 * FormData the action must receive.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReversePayRunButton } from "@/components/reverse-payrun-button";

const { reversePayRunMock } = vi.hoisted(() => ({
  reversePayRunMock: vi.fn(async (_formData: FormData) => {}),
}));

vi.mock("@/lib/actions/payroll", () => ({
  reversePayRun: (formData: FormData) => reversePayRunMock(formData),
}));

describe("ReversePayRunButton", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    reversePayRunMock.mockClear();
  });

  it("does not call the action until the in-page confirmation is confirmed, and sends the run id", async () => {
    render(<ReversePayRunButton id="run_123" date="2026-06-24" />);

    // 1. First click opens the confirmation — it must NOT submit yet.
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    expect(screen.getByText(/Reverse pay run for 2026-06-24\?/)).toBeTruthy();
    expect(reversePayRunMock).not.toHaveBeenCalled();

    // 2. Cancel backs out without submitting.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Reverse pay run for 2026-06-24\?/)).toBeNull();
    expect(reversePayRunMock).not.toHaveBeenCalled();

    // 3. Confirm submits the form; the action receives the run id.
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    fireEvent.click(screen.getByRole("button", { name: "Reverse pay run" }));
    await vi.waitFor(() => expect(reversePayRunMock).toHaveBeenCalledTimes(1));
    const formData = reversePayRunMock.mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBe("run_123");
  });

  it("shows the LedgerPro warning in the confirmation for a synced run", () => {
    render(<ReversePayRunButton id="run_9" date="2026-06-24" ledgerSyncedAt="2026-06-25T12:00:00.000Z" />);
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    expect(screen.getByText(/was posted to LedgerPro on 2026-06-25/)).toBeTruthy();
    expect(reversePayRunMock).not.toHaveBeenCalled();
  });
});
