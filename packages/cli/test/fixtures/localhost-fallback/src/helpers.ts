// Fallback at the end of a multi-line ternary on process.env (vercel/nextjs-subscription-payments)
export const getURL = (path = '') => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL &&
    process.env.NEXT_PUBLIC_SITE_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_SITE_URL
      : // If not set, default to localhost for local development.
        'http://localhost:3000/';
  return url + path;
};

export const apiBase = process.env.API_URL ?? 'http://localhost:4000';

export const authBase =
  process.env.AUTH_URL ||
  'http://127.0.0.1:9999';

export function siteUrl() {
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }
  return 'https://example.app';
}
