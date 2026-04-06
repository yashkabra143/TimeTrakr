import type { Express, Request, Response, NextFunction } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { storage } from "./storage.js";

// ── Razorpay SDK initialization (lazy — only instantiated when keys are present) ─
let _razorpay: Razorpay | null = null;
function getRazorpay(): Razorpay {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized — please log in" });
  }
  next();
}

// ── Session refresh helper ────────────────────────────────────────────────────
async function refreshSessionUser(req: Request, userId: string): Promise<void> {
  const user = await storage.getUserById(userId);
  if (user && req.session) {
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      profilePicture: user.profilePicture,
      planType: user.planType ?? "free",
      planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    };
  }
}

export function registerSubscriptionRoutes(app: Express) {

  // ── POST /api/subscriptions/create ───────────────────────────────────────
  // Creates a Razorpay subscription for the authenticated user.
  // Accepts { planType: 'monthly' | 'annual' }, resolves plan ID server-side.
  app.post("/api/subscriptions/create", requireAuth, async (req: Request, res: Response) => {
    try {
      const { planType } = req.body as { planType?: string };
      if (planType !== "monthly" && planType !== "annual") {
        return res.status(400).json({ message: "Invalid plan type" });
      }

      const planId =
        planType === "annual"
          ? process.env.RAZORPAY_PLAN_ANNUAL_ID!
          : process.env.RAZORPAY_PLAN_MONTHLY_ID!;

      const subscription = await getRazorpay().subscriptions.create({
        plan_id: planId,
        total_count: 120,
        quantity: 1,
        customer_notify: 0,
      });

      return res.status(200).json({ subscriptionId: subscription.id });
    } catch (error) {
      console.error("[SUBSCRIPTIONS CREATE] Error:", error);
      return res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // ── POST /api/subscriptions/verify ───────────────────────────────────────
  // Validates Razorpay payment signature and activates Pro plan.
  app.post("/api/subscriptions/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        razorpay_payment_id,
        razorpay_subscription_id,
        razorpay_signature,
      } = req.body as {
        razorpay_payment_id?: string;
        razorpay_subscription_id?: string;
        razorpay_signature?: string;
      };

      if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing required payment fields" });
      }

      // Validate HMAC-SHA256 signature
      const signedString = `${razorpay_payment_id}|${razorpay_subscription_id}`;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(signedString)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      // Fetch subscription to determine plan type and expiry
      const sub = await getRazorpay().subscriptions.fetch(razorpay_subscription_id) as any;

      let planType: string;
      if (sub.plan_id === process.env.RAZORPAY_PLAN_ANNUAL_ID) {
        planType = "pro_annual";
      } else if (sub.plan_id === process.env.RAZORPAY_PLAN_MONTHLY_ID) {
        planType = "pro_monthly";
      } else {
        planType = "pro_monthly";
      }

      let planExpiresAt: Date;
      if (sub.current_end) {
        planExpiresAt = new Date(sub.current_end * 1000);
      } else {
        const now = new Date();
        planExpiresAt = new Date(now.getTime() + (planType === "pro_annual" ? 365 : 30) * 24 * 60 * 60 * 1000);
      }

      await storage.updateUserPlan(
        req.session.userId!,
        planType,
        planExpiresAt,
        razorpay_subscription_id
      );

      await refreshSessionUser(req, req.session.userId!);

      return res.status(200).json({ success: true, planType });
    } catch (error) {
      console.error("[SUBSCRIPTIONS VERIFY] Error:", error);
      return res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // ── POST /api/subscriptions/cancel ───────────────────────────────────────
  // Cancels subscription at end of billing cycle (D-13: access continues until period end).
  app.post("/api/subscriptions/cancel", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      const razorpaySubId = user?.razorpaySubId;

      if (!razorpaySubId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      // cancel_at_cycle_end: 1 — access continues until period end (D-13)
      await getRazorpay().subscriptions.cancel(razorpaySubId, { cancel_at_cycle_end: 1 } as any);

      // Do NOT update planType/planExpiresAt here — webhook subscription.cancelled handles this.
      return res.status(200).json({
        success: true,
        message: "Subscription will be cancelled at end of billing period",
      });
    } catch (error) {
      console.error("[SUBSCRIPTIONS CANCEL] Error:", error);
      return res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ── GET /api/subscriptions/status ────────────────────────────────────────
  // Returns the latest subscription state from the DB (not just session).
  app.get("/api/subscriptions/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        planType: user.planType ?? "free",
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
        razorpaySubId: user.razorpaySubId ?? null,
      });
    } catch (error) {
      console.error("[SUBSCRIPTIONS STATUS] Error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/webhooks/razorpay ───────────────────────────────────────────
  // Receives Razorpay subscription lifecycle events. No auth — called by Razorpay servers.
  // Verifies HMAC signature using rawBody, processes idempotently.
  app.post("/api/webhooks/razorpay", async (req: Request, res: Response) => {
    try {
      // Verify signature using rawBody (required for correctness — body-parser alters body)
      const signature = req.headers["x-razorpay-signature"] as string | undefined;
      if (!signature) {
        return res.status(400).json({ message: "Missing webhook signature" });
      }

      const rawBody = req.rawBody;
      if (!rawBody) {
        return res.status(400).json({ message: "Missing request body" });
      }

      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
        .update(rawBody as Buffer)
        .digest("hex");

      if (expectedSignature !== signature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const event = req.body as any;
      const eventType = event.event as string;

      // Build idempotency key from subscription entity id + event type
      const subEntityId = event.payload?.subscription?.entity?.id as string | undefined;
      const eventId = subEntityId
        ? `${subEntityId}_${eventType}`
        : (event.event_id as string | undefined) ?? `${eventType}_${Date.now()}`;

      // Idempotency check — duplicate events are silently ignored (D-16)
      const existing = await storage.getWebhookEvent(eventId);
      if (existing) {
        return res.status(200).json({ message: "Already processed" });
      }

      // Log event before processing
      await storage.createWebhookEvent({
        eventId,
        eventType,
        payload: JSON.stringify(event),
        processed: false,
      });

      // Handle event types
      switch (eventType) {
        case "subscription.charged": {
          const subEntity = event.payload?.subscription?.entity as any;
          if (!subEntity) break;

          let planType: string;
          if (subEntity.plan_id === process.env.RAZORPAY_PLAN_ANNUAL_ID) {
            planType = "pro_annual";
          } else if (subEntity.plan_id === process.env.RAZORPAY_PLAN_MONTHLY_ID) {
            planType = "pro_monthly";
          } else {
            planType = "pro_monthly";
          }

          const planExpiresAt = subEntity.current_end
            ? new Date(subEntity.current_end * 1000)
            : null;

          // Find user by razorpaySubId
          const user = await storage.getUserByRazorpaySubId(subEntity.id);
          if (user) {
            await storage.updateUserPlan(user.id, planType, planExpiresAt, subEntity.id);
            console.log(`[WEBHOOK] subscription.charged — activated ${planType} for user ${user.id}`);
          } else {
            console.warn(`[WEBHOOK] subscription.charged — no user found for subId ${subEntity.id}`);
          }
          break;
        }

        case "subscription.cancelled": {
          // No action needed — planExpiresAt already set from last subscription.charged.
          console.log(`[WEBHOOK] subscription.cancelled — subId ${subEntityId}, no plan change needed`);
          break;
        }

        case "subscription.halted": {
          // Payment retries exhausted — immediately revoke Pro access
          const subEntity = event.payload?.subscription?.entity as any;
          if (!subEntity) break;

          const user = await storage.getUserByRazorpaySubId(subEntity.id);
          if (user) {
            await storage.updateUserPlan(user.id, "free", null, null);
            console.log(`[WEBHOOK] subscription.halted — revoked Pro for user ${user.id}`);
          } else {
            console.warn(`[WEBHOOK] subscription.halted — no user found for subId ${subEntity.id}`);
          }
          break;
        }

        default:
          console.log(`[WEBHOOK] Unhandled event type: ${eventType}`);
      }

      return res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("[WEBHOOK] Error processing webhook:", error);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}
