// Netlify Function: cancels a subscribed user's Stripe subscription.
//
// The cancellation is set to take effect at the END of their current
// billing period (not immediately) — this is standard, fair practice:
// they keep access through what they already paid for. When the period
// actually ends, Stripe fires customer.subscription.deleted, which the
// existing stripe-webhook function already handles by setting
// subscribed: false in Firestore — so no extra Firestore write is needed
// here beyond confirming the cancellation was scheduled.
//
// Required environment variables (same as the other Stripe functions):
//   STRIPE_SECRET_KEY
//   FIREBASE_SERVICE_ACCOUNT

import Stripe from "stripe";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server is missing required environment variables." }) };
  }

  let uid = null;
  try {
    const parsed = JSON.parse(event.body || "{}");
    uid = parsed.uid || null;
  } catch (e) {
    // fall through, handled by the uid check below
  }

  if (!uid) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing user id." }) };
  }

  const stripe = new Stripe(secretKey);
  const db = getAdminDb();

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "Account not found." }) };
    }
    const customerId = userDoc.data().stripeCustomerId;
    if (!customerId) {
      return { statusCode: 400, body: JSON.stringify({ error: "No billing account on file for this user." }) };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "No active subscription found." }) };
    }

    const subscription = subscriptions.data[0];
    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        cancelled: true,
        accessUntil: new Date(updated.current_period_end * 1000).toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
