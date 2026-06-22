/**
 * Email utilities — Resend integration for pay stub delivery and notifications.
 *
 * Auth.js handles magic-link emails internally via the Resend provider.
 * This module handles application emails: pay stubs, welcome emails, reports.
 */

import { Resend } from "resend";

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

/**
 * Send a pay stub PDF to an employee.
 * In Phase 4 MVP, sends a link to view the stub online.
 */
export async function sendPayStubEmail(params: {
  to: string;
  employeeName: string;
  payDate: string;
  stubUrl: string;
}) {
  const { to, employeeName, payDate, stubUrl } = params;

  try {
    const client = getResend();
    await client.emails.send({
      from: process.env.AUTH_RESEND_FROM ?? "noreply@nexvarlab.com",
      to,
      subject: `Your pay stub for ${payDate} — Nexvar Pay`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color: #0F172A;">Nexvar Pay</h1>
          <p style="color: #78716C; font-size: 12px;">A NexvarLab product</p>
          <p>Hi ${employeeName},</p>
          <p>Your pay stub for the pay period ending <strong>${payDate}</strong> is available.</p>
          <p>
            <a href="${stubUrl}" style="display: inline-block; background: #0F172A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
              View pay stub
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            This is an automated message from Nexvar Pay. If you have questions, contact your employer.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send pay stub email:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send a welcome email when an employee is added.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  employeeName: string;
  companyName: string;
}) {
  const { to, employeeName, companyName } = params;

  try {
    const client = getResend();
    await client.emails.send({
      from: process.env.AUTH_RESEND_FROM ?? "noreply@nexvarlab.com",
      to,
      subject: `Welcome to ${companyName} payroll — Nexvar Pay`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="color: #0F172A;">Nexvar Pay</h1>
          <p style="color: #78716C; font-size: 12px;">A NexvarLab product</p>
          <p>Hi ${employeeName},</p>
          <p>You've been added to <strong>${companyName}</strong>'s payroll on Nexvar Pay.</p>
          <p>You'll receive your pay stubs by email each pay period.</p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            Powered by Nexvar Pay — Canadian payroll that runs itself.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { success: false, error: String(error) };
  }
}
