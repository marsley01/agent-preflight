import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, fail, warn, info } from '../types.js';

const PAYMENT_DEPS = ['stripe', '@stripe/stripe-js', '@paypal/checkout-server-sdk', '@lemonsqueezy/lemonsqueezy.js', 'paystack', 'flutterwave-node-v3', 'mpesa-node', 'razorpay', '@polar-sh/sdk', 'square'];
const PAYMENT_CONTENT = /stripe|mpesa|daraja|stkpush|paystack|flutterwave|lemonsqueezy|paypal|razorpay|polar/i;
const SIGNATURE = /constructEvent|webhooks\.(construct|verify)|validateWebhook|verifySignature|verifyWebhook|timingSafeEqual|createHmac|X-Mpesa-Signature|x-paystack-signature|verif(y|ied)_?signature|standardwebhooks|svix/i;
const IDEMPOTENCY = /idempotencyKey|idempotency_key|Idempotency-Key|TransactionID|CheckoutRequestID|MpesaReceiptNumber|event\.id|processed_events|ON CONFLICT|upsert/i;
const CLIENT_AMOUNT = /amount\s*:\s*(body|req\.body|data|input|formData)\.\w*amount|unit_amount\s*:\s*(body|req\.body|data|input)\./i;

/**
 * Check for payment handling issues:
 * - Webhook signature validation (Stripe, M-Pesa Daraja, Paystack, ...)
 * - Idempotent webhook processing (no double-credit on retries)
 * - Prices taken from the client request
 */
export function runPaymentChecks(ctx: ProjectContext): CheckResult[] {
  const results: CheckResult[] = [];
  const usesPayments = ctx.hasDependency(...PAYMENT_DEPS) || ctx.code.some((f) => PAYMENT_CONTENT.test(f.rel));
  if (!usesPayments) {
    return [info('payments/not-applicable', 'No payment integration detected — skipping payment checks')];
  }

  const webhooks = ctx.code.filter((f) => /webhook|callback|ipn|notify/i.test(f.rel) && PAYMENT_CONTENT.test(f.rel + f.content));
  if (webhooks.length === 0) {
    results.push(warn('payments/no-webhook', 'medium', 'Payments used but no webhook handler found — relying on client redirects to confirm payment is spoofable', {
      fix: 'Confirm payments server-side from the provider webhook, never from the success-page redirect.',
    }));
  }

  for (const f of webhooks) {
    if (SIGNATURE.test(f.content)) {
      results.push(pass('payments/webhook-signature', 'Webhook signature verified', { file: f.rel }));
    } else {
      results.push(fail('payments/webhook-signature', 'critical', 'Payment webhook does not verify signatures — anyone can POST a fake "payment succeeded" event', {
        file: f.rel,
        fix: /mpesa|daraja/i.test(f.rel + f.content)
          ? 'M-Pesa callbacks are unsigned: put a secret token in the CallBackURL path, allowlist Safaricom IPs, and re-query the transaction status API before crediting.'
          : 'Use stripe.webhooks.constructEvent(rawBody, sig, secret) (or your provider\'s verify helper) on the raw request body.',
      }));
    }
    if (!IDEMPOTENCY.test(f.content)) {
      results.push(warn('payments/idempotency', 'medium', 'Webhook handler has no idempotency guard — provider retries can double-credit orders', {
        file: f.rel,
        fix: 'Record processed event IDs (unique constraint) and skip duplicates.',
      }));
    }
  }

  for (const m of ctx.grep(ctx.code, CLIENT_AMOUNT)) {
    results.push(fail('payments/client-amount', 'high', 'Charge amount taken from the request body — users can pay whatever they want', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Look up the price server-side from your product/price ID.',
    }));
  }

  return results;
}
