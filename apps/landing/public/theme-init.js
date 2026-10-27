// Apply the saved theme before first paint (no flash). Loaded as an external file so CSP can stay `script-src 'self'`.
try {
  var t = localStorage.getItem('preflight-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
