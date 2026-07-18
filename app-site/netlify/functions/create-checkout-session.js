// Netlify Function: creates a Stripe Checkout session for the subscription
// and returns the hosted checkout URL for the frontend to redirect to.
//
// Required environment variables (set these in Netlify dashboard,
// Site configuration > Environment variables — NEVER commit these to code):
//   STRIPE_SECRET_KEY  — starts with sk_live_... or sk_test_... (or a restricted rk_ key)
//   STRIPE_PRICE_ID    — starts with price_...
//
// The frontend calls this function via POST to /.netlify/functions/create-checkout-session
// with a JSON body of { uid, email } identifying the signed-in Firebase user,
// and redirects the browser to the returned session URL.

import Stripe from "stripe";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server is missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID environment variables.",
      }),
    };
  }

  let uid = null;
  let email = null;
  try {
    const parsed = JSON.parse(event.body || "{}");
    uid = parsed.uid || null;
    email = parsed.email || null;
  } catch (e) {
    // No body / invalid JSON — proceed without user linkage rather than failing outright
  }

  const stripe = new Stripe(secretKey);
  const siteUrl = process.env.URL || "https://crtrrtapp.netlify.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
      allow_promotion_codes: true,
      // client_reference_id links this Stripe session back to the Firebase user,
      // so a webhook can mark the correct account as subscribed after payment.
      client_reference_id: uid || undefined,
      customer_email: email || undefined,
      metadata: uid ? { firebase_uid: uid } : undefined,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
