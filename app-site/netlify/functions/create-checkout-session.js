// Netlify Function: creates a Stripe Checkout session for the subscription
// and returns the hosted checkout URL for the frontend to redirect to.
//
// Required environment variables (set these in Netlify dashboard,
// Site configuration > Environment variables — NEVER commit these to code):
//   STRIPE_SECRET_KEY  — starts with sk_live_... or sk_test_...
//   STRIPE_PRICE_ID    — starts with price_...
//
// The frontend calls this function via POST to /.netlify/functions/create-checkout-session
// and redirects the browser to the returned session URL.

const Stripe = require("stripe");

exports.handler = async (event) => {
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

  const stripe = Stripe(secretKey);

  // The site's own URL, used to build success/cancel redirect links.
  // Netlify automatically provides this at build/runtime.
  const siteUrl = process.env.URL || "https://crtrrtapp.netlify.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
      allow_promotion_codes: true,
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
