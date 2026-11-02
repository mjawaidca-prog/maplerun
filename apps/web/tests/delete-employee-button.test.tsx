// @vitest-environment jsdom
/**
 * DeleteEmployeeButton — client wiring regression test.
 *
 * The original component gated the form submit on the native
 * `window.confirm()` dialog inside the button's onClick. In any
 * browsing context where that dialog cannot be displayed (embedded
 * or sandboxed frames without allow-modals, dialog-suppressing
 * automation), `confirm()` returns false instantly, the handler
 * calls preventDefault(), and the button renders but NEVER fires —
 * no dialog, no error, no state change. jsdom does not implement
 * window.confirm either, so the old component fails this suite for
 * the same reason. Mirrors tests/reverse-payrun-button.test.tsx
 * (PR #24), which converted ReversePayRunButton first.
 *
 * The server action itself is mocked: this test exercises only the
 * click → in-page confirmation → submit path, plus the exact
 * FormData the action must receive. The idle control is icon-only;
 * its accessible name comes from its title (`Delete <name>`), as in
 * the component itself.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DeleteEmployeeButton } from "@/components/delete-employee-button";

const { deleteEmployeeMock } = vi.hoisted(() => ({
  deleteEmployeeMock: vi.fn(async (_formData: FormData) => {}),
}));

vi.mock("@/lib/actions/employee", () => ({
  deleteEmployee: (formData: FormData) => deleteEmployeeMock(formData),
}));

describe("DeleteEmployeeButton", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    deleteEmployeeMock.mockClear();
  });

  it("does not call the action until the in-page confirmation is confirmed, and sends the employee id", async () => {
    render(<DeleteEmployeeButton id="emp_789" name="Priya Sandhu" />);

    // 1. First click opens the confirmation — it must NOT submit yet.
    fireEvent.click(screen.getByRole("button", { name: "Delete Priya Sandhu" }));
    expect(screen.getByText(/Delete Priya Sandhu\?/)).toBeTruthy();
    expect(deleteEmployeeMock).not.toHaveBeenCalled();

    // 2. Cancel backs out without submitting.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Delete Priya Sandhu\?/)).toBeNull();
    expect(deleteEmployeeMock).not.toHaveBeenCalled();

    // 3. Confirm submits the form; the action receives the employee id.
    fireEvent.click(screen.getByRole("button", { name: "Delete Priya Sandhu" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete employee" }));
    await vi.waitFor(() => expect(deleteEmployeeMock).toHaveBeenCalledTimes(1));
    const formData = deleteEmployeeMock.mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBe("emp_789");
  });
});
