import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

export async function runPaymentChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const webhookFiles = await glob(
    `${dir}/**/{webhook,webhooks,mpesa,stripe,payment}/**/*.{ts,tsx,js}`,
    { ignore: ['**/node_modules/**', '**/.next/**'] }
  );

  const apiFiles = await glob(`${dir}/src/app/api/**/*.ts`, { ignore: ['**/node_modules/**'] });
  const allFiles = [...new Set([...webhookFiles, ...apiFiles])];
  const paymentRelatedFiles = allFiles.filter(f =>
    /webhook|stripe|mpesa|payment|daraja|stk/i.test(f)
  );

  if (paymentRelatedFiles.length === 0) {
    results.push({ status: 'warn', message: 'No payment-related files detected \u2014 skipping payment checks' });
    return results;
  }

  let hasSignatureValidation = false;
  let signatureFile: string | undefined;

  for (const file of paymentRelatedFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('constructEvent') ||
      content.includes('stripe.webhooks') ||
      content.includes('X-Mpesa-Signature') ||
      content.includes('validateWebhook') ||
      content.includes('verifySignature') ||
      content.includes('crypto.timingSafeEqual') ||
      content.includes('hmac')
    ) {
      hasSignatureValidation = true;
      signatureFile = path.relative(dir, file);
      break;
    }
  }

  if (hasSignatureValidation) {
    results.push({ status: 'pass', message: 'Webhook signature validation found', file: signatureFile });
  } else {
    const firstFile = path.relative(dir, paymentRelatedFiles[0]);
    results.push({
      status: 'fail',
      message: 'No webhook signature validation found \u2014 anyone can fake payment events',
      file: firstFile,
    });
  }

  let hasErrorHandling = false;
  for (const file of paymentRelatedFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('try') && content.includes('catch')) {
      hasErrorHandling = true;
      break;
    }
  }

  if (hasErrorHandling) {
    results.push({ status: 'pass', message: 'Error handling (try/catch) found in payment routes' });
  } else {
    results.push({ status: 'warn', message: 'No try/catch found in payment files \u2014 unhandled failures will crash' });
  }

  let hasIdempotency = false;
  for (const file of paymentRelatedFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('idempotencyKey') ||
      content.includes('idempotency_key') ||
      content.includes('TransactionID') ||
      content.includes('CheckoutRequestID')
    ) {
      hasIdempotency = true;
      break;
    }
  }

  results.push(
    hasIdempotency
      ? { status: 'pass', message: 'Idempotency keys found in payment flow' }
      : { status: 'warn', message: 'No idempotency keys detected \u2014 duplicate payments may occur' }
  );

  return results;
}
