"use strict";
// Payments: Cash on Delivery (always) + Stripe (PaymentIntent + verified webhooks).
// Without STRIPE_SECRET_KEY, online methods return 503 PAYMENTS_NOT_CONFIGURED
// (set STRIPE_MOCK=true only for local development). Card data is NEVER stored.
const cfg = require("./config");
const { bad } = require("./utils");
let stripe = null;
if (cfg.stripeKey) stripe = require("stripe")(cfg.stripeKey);
const MODES = { cod: "cod", card: "stripe", wallet: "stripe" };
async function createIntent({ method, amount, currency, orderCode, orderId }) {
  if (method === "cod") return { provider: "cod", ref: "COD-" + orderCode, clientSecret: null, mode: "cod" };
  if (!stripe) {
    if (cfg.stripeMock) return { provider: "mock", ref: "MOCK-" + orderCode, clientSecret: null, mode: "mock" };
    throw bad(503, "PAYMENTS_NOT_CONFIGURED", "Online payments require STRIPE_SECRET_KEY");
  }
  const pi = await stripe.paymentIntents.create({ amount: Math.round(Number(amount) * 100),
    currency: (currency || "usd").toLowerCase(), metadata: { orderCode, orderId },
    automatic_payment_methods: { enabled: true, allow_redirects: "never" } });
  return { provider: "stripe", ref: pi.id, clientSecret: pi.client_secret, mode: "live" };
}
function verifyWebhook(rawBody, signature) {
  if (!stripe || !cfg.stripeWebhook) throw bad(503, "PAYMENTS_NOT_CONFIGURED", "Webhook not configured");
  return stripe.webhooks.constructEvent(rawBody, signature, cfg.stripeWebhook);
}
module.exports = { createIntent, verifyWebhook, hasStripe: () => !!stripe, stripe };
