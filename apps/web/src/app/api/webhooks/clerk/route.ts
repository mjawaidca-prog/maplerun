/**
 * Clerk webhook receiver — syncs Clerk identity events into the app User
 * table (see lib/clerk-user.ts). Svix signature verification is performed by
 * Clerk's `verifyWebhook()` (uses CLERK_WEBHOOK_SIGNING_SECRET).
 *
 * Public at the proxy layer in BOTH modes (Clerk must be able to reach it),
 * but the handler self-disables with 404 unless APP_AUTH_PROVIDER=clerk, so
 * the endpoint is inert until the cutover is prepared.
 */

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { isClerkAuth } from "@/lib/auth-mode";
import {
  profileFromWebhookData,
  syncClerkUserCreated,
  syncClerkUserDeleted,
  syncClerkUserUpdated,
} from "@/lib/clerk-user";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (!isClerkAuth()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed", err);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 },
    );
  }

  try {
    switch (evt.type) {
      case "user.created": {
        const profile = profileFromWebhookData(evt.data);
        if (profile) await syncClerkUserCreated(profile);
        break;
      }
      case "user.updated": {
        const profile = profileFromWebhookData(evt.data);
        if (profile) await syncClerkUserUpdated(profile);
        break;
      }
      case "user.deleted": {
        if (evt.data.id) await syncClerkUserDeleted(evt.data.id);
        break;
      }
      default:
        // Other event types are acknowledged and ignored.
        break;
    }
  } catch (err) {
    // Acknowledge with 500 so Clerk retries transient sync failures.
    console.error(`[clerk-webhook] sync failed for ${evt.type}`, err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
