"use server";

/**
 * Password reset actions — the form-facing layer over lib/password-reset.ts.
 *
 * requestPasswordResetAction deliberately returns the same shape for every
 * input so the /forgot-password page can show one neutral confirmation and
 * never reveal whether an account exists.
 */

import {
  requestPasswordReset,
  resetPasswordWithToken,
  type ResetPasswordResult,
} from "@/lib/password-reset";

export async function requestPasswordResetAction(
  email: string,
): Promise<{ ok: true }> {
  await requestPasswordReset(email);
  return { ok: true };
}

export async function resetPasswordAction(params: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  return resetPasswordWithToken(params);
}
