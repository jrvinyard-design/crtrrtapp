// Netlify Function: Stripe webhook listener.
//
// This is what actually flips a user's `subscribed` flag to true in
// Firestore after they successfully pay — the checkout function alone
// only starts the payment flow, it doesn't confirm payment happened.
//
// Required environment variables (Netlify dashboard > Environment variables):
//   STRIPE_SECRET_KEY          — same key used by create-checkout-session
//   STRIPE_WEBHOOK_SECRET      — starts with whsec_..., from Stripe's webhook settings
//   FIREBASE_SERVICE_ACCOUNT   — the full JSON content of a Firebase service
//                                 account key, as a single-line string
//
// Setup required in Stripe Dashboard (Developers > Webhooks):
//   Endpoint URL: https://crtrrtapp.netlify.app/.netlify/functions/stripe-webhook
//   Events to send: checkout.session.completed, customer.subscription.deleted

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
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return { statusCode: 500, body: "Missing required environment variables." };
  }

  const stripe = new Stripe(secretKey);
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      webhookSecret
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature verification failed: ${err.message}` };
  }

  const db = getAdminDb();

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const uid = session.client_reference_id || (session.metadata && session.metadata.firebase_uid);
      if (uid) {
        await db.collection("users").doc(uid).set(
          {
            subscribed: true,
            stripeCustomerId: session.customer || null,
            subscribedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    if (stripeEvent.type === "customer.subscription.deleted") {
      const subscription = stripeEvent.data.object;
      const customerId = subscription.customer;
      // Find the user by their stored Stripe customer ID and mark them unsubscribed
      const snapshot = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.set({ subscribed: false }, { merge: true });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
