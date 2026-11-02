/**
 * Employee portal invitation email (Wave 3, A4).
 *
 * Same Resend configuration as lib/email.ts. The invitation carries NO
 * token: employees authenticate with Clerk (the shared "Nexvar" identity),
 * so the email simply tells them to sign in at the portal with the email
 * address the employer invited. Nothing in this email can be forwarded to
 * gain access — access binds to the Clerk-verified email on first sign-in.
 */

import { Resend } from "resend";
import { PAY_URL } from "@/lib/seo";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new Error("AUTH_RESEND_KEY is not set. Email delivery is disabled.");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendEmployeePortalInviteEmail(params: {
  to: string;
  employeeName: string;
  companyName: string;
}) {
  const { to, employeeName, companyName } = params;
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? PAY_URL}/portal`;

  try {
    const client = getResend();
    await client.emails.send({
      from: process.env.AUTH_RESEND_FROM ?? "noreply@nexvarlab.com",
      to,
      subject: `Your ${companyName} employee portal — Nexvar Pay`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color: #0F172A;">Nexvar Pay</h1>
          <p style="color: #78716C; font-size: 12px;">A NexvarLab product</p>
          <p>Hi ${employeeName},</p>
          <p><strong>${companyName}</strong> has invited you to their employee portal on Nexvar Pay. There you can:</p>
          <ul>
            <li>View and download your pay stubs</li>
            <li>Check your personal details on file</li>
            <li>Submit updates to your address, TD1 amounts, and direct-deposit banking for your employer to approve</li>
          </ul>
          <p>
            <a href="${portalUrl}" style="display: inline-block; background: #0F172A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
              Open the employee portal
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            Sign in with this email address (${to}) — that's how the portal knows which employee record is yours.
            If you weren't expecting this invitation, contact ${companyName}.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send portal invite email:", error);
    return { success: false, error: String(error) };
  }
}
