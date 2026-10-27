import type { CheckResult } from './types';

/** The subset of the engine's scan context these checks need. */
export interface RunnerCtx {
  files: Map<string, string | null>;
  allFilePaths: string[];
  codeFiles: string[];
  codeJoined: string;
}

interface Hit {
  file: string;
  line: number;
  snippet: string;
  match: RegExpExecArray;
}

const MAX_PER_RULE = 5;
const NON_SOURCE = /(^|\/)(node_modules|dist|build|out|\.next|\.svelte-kit|\.astro|vendor|coverage|__tests__|__mocks__|fixtures|e2e|cypress|playwright|tests?|stories|storybook-static|docs?)\/|\.(test|spec|stories)\.\w+$|\.d\.ts$|\.min\.(js|css)$/i;
const FRONTEND_RE = /\.(html|jsx|tsx|vue|svelte|astro)$/;
const STYLE_RE = /\.(css|scss|sass|less)$/;
const SCRIPT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro)$/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|<!--|\{\s*\/\*)/;

// ---------------------------------------------------------------- helpers

function content(ctx: RunnerCtx, file: string): string {
  return ctx.files.get(file) ?? '';
}

function sourceFiles(ctx: RunnerCtx, re: RegExp): string[] {
  return [...ctx.files.keys()].filter((f) => re.test(f) && !NON_SOURCE.test(f) && ctx.files.get(f));
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** All matches of a global regex across files, with line numbers; comment lines skipped. */
function scan(ctx: RunnerCtx, files: string[], re: RegExp, keep?: (h: Hit, text: string) => boolean): Hit[] {
  const hits: Hit[] = [];
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  for (const file of files) {
    const text = content(ctx, file);
    const lines = text.split('\n');
    const rx = new RegExp(re.source, flags);
    for (let m = rx.exec(text); m; m = rx.exec(text)) {
      if (m[0] === '') {
        rx.lastIndex++;
        continue;
      }
      const line = lineOf(text, m.index);
      const lineText = lines[line - 1] ?? '';
      if (COMMENT_LINE.test(lineText)) continue;
      const hit: Hit = { file, line, snippet: lineText.trim().slice(0, 200), match: m };
      if (!keep || keep(hit, text)) hits.push(hit);
    }
  }
  return hits;
}

/** Up to MAX_PER_RULE located results, then one summary line for the rest. */
function capped(checkId: string, hits: Hit[], message: (h: Hit) => string, status: CheckResult['status'] = 'warn'): CheckResult[] {
  const out: CheckResult[] = hits.slice(0, MAX_PER_RULE).map((h) => ({ checkId, status, message: message(h), file: h.file, line: h.line, snippet: h.snippet }));
  if (hits.length > MAX_PER_RULE) {
    const files = new Set(hits.slice(MAX_PER_RULE).map((h) => h.file)).size;
    out.push({ checkId, status, message: `${hits.length - MAX_PER_RULE} more like this in ${files} file${files === 1 ? '' : 's'}` });
  }
  return out;
}

function dependencyNames(ctx: RunnerCtx): Set<string> {
  const names = new Set<string>();
  for (const f of ctx.files.keys()) {
    if (!/(^|\/)package\.json$/.test(f) || /node_modules/.test(f)) continue;
    try {
      const pkg = JSON.parse(content(ctx, f));
      for (const k of ['dependencies', 'devDependencies', 'peerDependencies']) Object.keys(pkg[k] ?? {}).forEach((n) => names.add(n));
    } catch {
      // malformed package.json
    }
  }
  return names;
}

/** Code that ships to the browser. In Next.js only 'use client' files count (components/ may be server components). */
export function getClientFiles(ctx: RunnerCtx): string[] {
  const deps = dependencyNames(ctx);
  const isNext = deps.has('next');
  const isSpa = ctx.allFilePaths.some((f) => /(^|\/)vite\.config\.\w+$/.test(f)) || deps.has('react-scripts');
  const candidates = [...ctx.codeFiles, ...sourceFiles(ctx, /\.(vue|svelte)$/)];
  return candidates.filter((f) => {
    if (/(^|\/)(api|server|supabase\/functions|convex|scripts|migrations|pb_migrations)\//.test(f) || /\.server\.\w+$|(^|\/)\+(page|layout)\.server\.|(^|\/)\+server\./.test(f)) return false;
    const text = content(ctx, f);
    if (/^\s*['"]use server['"]|import\s+['"]server-only['"]/m.test(text.slice(0, 1000))) return false;
    if (/^\s*['"]use client['"]/m.test(text.slice(0, 500))) return true;
    if (isNext) return false;
    if (/\.(vue|svelte)$/.test(f)) return true;
    return /(^|\/)(components|hooks)\//.test(f) || (isSpa && /(^|\/)src\//.test(f));
  });
}

// ---------------------------------------------------------------- color contrast

const SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const PALETTE_HEX: Record<string, string[]> = {
  gray: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827', '#030712'],
  slate: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617'],
  zinc: ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b', '#09090b'],
  neutral: ['#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#404040', '#262626', '#171717', '#0a0a0a'],
  stone: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524', '#1c1917', '#0c0a09'],
};
const YELLOW: Record<number, string> = { 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15' };

export function tailwindHex(token: string): string | null {
  if (token === 'white') return '#ffffff';
  if (token === 'black') return '#000000';
  const m = /^(gray|slate|zinc|neutral|stone|yellow)-(\d{2,3})$/.exec(token);
  if (!m) return null;
  const shade = Number(m[2]);
  if (m[1] === 'yellow') return YELLOW[shade] ?? null;
  const i = SCALE.indexOf(shade);
  return i >= 0 ? PALETTE_HEX[m[1]][i] : null;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** className="..." / class="..." / className={`...`} / cn("...") string literals, with their offset. */
const CLASS_STRING = /(?:\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})|\b(?:cn|clsx|cva|twMerge)\(\s*["'`]([^"'`]*)["'`])/g;

const INTERACTIVE_TAG = /^(button|a|input|select|textarea|summary)$|(Button|Input|Trigger|Link|Textarea|Select|Item|Tab|Toggle|Checkbox|Radio|Switch|Slider)$/;
// Focus styles, or the selected/highlighted state that keyboard-driven widgets (cmdk, Radix menus) use instead.
const FOCUS_REPLACEMENT = /(?:^|[\s"'`])(?:[\w-]+:)*(?:(?:focus|focus-visible|focus-within)[\w-]*:(?:ring|outline|border|shadow|bg|underline)(?!-none)|aria-selected:(?:bg|ring|text)|data-\[(?:selected|highlighted|focus)[^\]]*\]:(?:bg|ring|text)|data-(?:highlighted|selected):(?:bg|ring|text))/;

/**
 * outline-none on something keyboard users tab to, with no focus style anywhere in the same
 * class call (cn()/cva() often spread focus styles across later strings or variants).
 * Containers that only get programmatic focus (lists, panels) are not flagged.
 */
function isUnreplacedFocusRemoval(text: string, index: number, matched: string): boolean {
  const isRecipe = /^\s*\b(?:cva|tv)\(/.test(matched);
  const tag = [...text.slice(Math.max(0, index - 400), index).matchAll(/<([A-Za-z][\w.]*)/g)].pop()?.[1];
  const interactive = isRecipe || (tag ? INTERACTIVE_TAG.test(tag.split('.').pop()!) : false);
  if (!interactive) return false;
  return !FOCUS_REPLACEMENT.test(text.slice(index, index + 1500));
}

// ---------------------------------------------------------------- UI & Content

const BOILERPLATE: Array<[RegExp, string]> = [
  [/Create Next App/, 'Default "Create Next App" title'],
  [/Generated by create next app/i, 'Default create-next-app description'],
  [/Get started by editing/, 'create-next-app starter page copy'],
  [/Edit\s*(<code>)?\s*src\/App\.[jt]sx?(<\/code>)?\s*and save to (reload|test HMR)/, 'Starter page copy ("Edit src/App and save")'],
  [/<title>\s*Vite \+ (React|Vue|Svelte|Preact|TS)/, 'Default Vite page title'],
  [/Click on the Vite and \w+ logos/, 'Vite starter page copy'],
  [/count is \{count\}/, 'Vite starter counter demo'],
  [/Welcome to Next\.js/, 'Next.js starter heading'],
  [/>\s*Learn React\s*</, 'Create React App starter link'],
  [/rel=["'](?:shortcut )?icon["'][^>]*href=["']\/vite\.svg["']|href=["']\/vite\.svg["'][^>]*rel=["'](?:shortcut )?icon["']/, 'Vite logo used as the favicon'],
  [/src=["']\/(next|vercel)\.svg["']/, 'Next.js starter logo still rendered'],
  [/from\s+['"]\.\/assets\/react\.svg['"]/, 'Vite starter React logo still imported'],
];

const PLACEHOLDER = /lorem ipsum|\bYour Company\b|\bCompany Name\b|\bAcme (?:Inc|Corp|Co)\b|\b(?:John|Jane) Doe\b/i;

const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
  '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial', 'unset', 'revert', 'segoe ui', 'helvetica', 'helvetica neue', 'arial',
  'apple color emoji', 'segoe ui emoji', 'noto color emoji', 'menlo', 'monaco', 'consolas', 'courier new', 'sfmono-regular', 'emoji', 'math',
]);

export function runUiChecks(ctx: RunnerCtx): CheckResult[] {
  const frontend = sourceFiles(ctx, FRONTEND_RE);
  if (frontend.length === 0) {
    return [{ checkId: 'ui-not-applicable', status: 'info', message: 'No frontend files found: UI checks skipped' }];
  }
  const results: CheckResult[] = [];
  const scripts = sourceFiles(ctx, SCRIPT_RE);
  const styles = sourceFiles(ctx, STYLE_RE);
  const markup = [...new Set([...frontend, ...scripts])];
  const deps = dependencyNames(ctx);
  const all = [...frontend, ...scripts, ...styles].map((f) => content(ctx, f)).join('\n');

  // Boilerplate
  const boiler: Array<Hit & { label: string }> = [];
  for (const [re, label] of BOILERPLATE) for (const h of scan(ctx, markup, re)) boiler.push({ ...h, label });
  results.push(...(boiler.length
    ? capped('ui-boilerplate', boiler, (h) => `${(h as Hit & { label: string }).label} still in the app`)
    : [{ checkId: 'ui-boilerplate', status: 'pass' as const, message: 'No starter template leftovers found' }]));

  // Placeholder copy (placeholder="..." on inputs is legitimate)
  const placeholders = scan(ctx, markup, PLACEHOLDER, (h) => !/placeholder\s*[=:]/i.test(h.snippet) && !/(^|\/)(seed|mock|demo|example)s?[./]/i.test(h.file));
  results.push(...(placeholders.length
    ? capped('ui-placeholder-text', placeholders, (h) => `Placeholder text "${h.match[0]}" in the UI`)
    : [{ checkId: 'ui-placeholder-text', status: 'pass' as const, message: 'No placeholder copy found' }]));

  // Dead links
  const dead = scan(ctx, frontend, /<(?:a|Link)\b[^>]*?\bhref=(?:["'](?:#|javascript:void\(0\);?)?["']|\{\s*["'](?:#)?["']\s*\})/);
  results.push(...(dead.length
    ? capped('ui-dead-links', dead, () => 'Link goes nowhere (href="#", empty or javascript:void(0))')
    : [{ checkId: 'ui-dead-links', status: 'pass' as const, message: 'No dead links found' }]));

  // Hardcoded localhost (not env fallbacks, configs, scripts or log lines)
  const localhost = scan(
    ctx,
    markup.filter((f) => !/(^|\/)(scripts|server)\/|\.config\.\w+$|(^|\/)(server|app|index)\.(ts|js|mjs)$/.test(f)),
    /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s'"`)]*/,
    (h, text) => {
      // Env fallbacks are often split across lines: `process.env.X\n  ? ...\n  : "http://localhost:3000"`.
      const context = text.split('\n').slice(Math.max(0, h.line - 3), h.line).join('\n');
      return !/process\.env|import\.meta\.env|\?\?|\|\||console\.|listen|NODE_ENV|isDev|development|emulator/i.test(context) && !/^\s*[:?]/.test(h.snippet);
    },
  );
  results.push(...(localhost.length
    ? capped('ui-localhost-url', localhost, (h) => `Hardcoded ${h.match[0]} breaks in production`)
    : [{ checkId: 'ui-localhost-url', status: 'pass' as const, message: 'No hardcoded localhost URLs' }]));

  // Debug leftovers
  const debuggers = scan(ctx, scripts, /(?<![\w.$])debugger\s*;?\s*$/m);
  const logs = scan(ctx, getClientFiles(ctx).filter((f) => !NON_SOURCE.test(f)), /\bconsole\.log\s*\(/);
  results.push(...capped('ui-debug-leftovers', debuggers, () => 'debugger statement left in code'));
  results.push(...capped('ui-debug-leftovers', logs, () => 'console.log in browser code'));
  if (!debuggers.length && !logs.length) results.push({ checkId: 'ui-debug-leftovers', status: 'pass', message: 'No debugger statements or browser console.log' });

  // Images without alt (tags can span lines; JSX props can contain braces)
  const imgTag = /<(img|Image)\b((?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*?)\/?>/;
  const noAlt = scan(ctx, frontend, imgTag, (h) => !/\balt\s*=/.test(h.match[2]) && !/\{\s*\.\.\./.test(h.match[2]));
  results.push(...(noAlt.length
    ? capped('ui-img-alt', noAlt, (h) => `<${h.match[1]}> without alt text`)
    : [{ checkId: 'ui-img-alt', status: 'pass' as const, message: 'All images have alt text' }]));

  // Focus outline removed without replacement + low contrast, per class string
  const focusHits: Hit[] = [];
  const contrastHits: Array<Hit & { label: string }> = [];
  for (const h of scan(ctx, frontend, CLASS_STRING)) {
    const classes = (h.match[1] ?? h.match[2] ?? h.match[3] ?? h.match[4] ?? '').split(/\s+/).filter(Boolean);
    if (classes.some((c) => /(^|:)outline-none$/.test(c)) && isUnreplacedFocusRemoval(content(ctx, h.file), h.match.index, h.match[0])) {
      focusHits.push(h);
    }
    const plain = classes.filter((c) => !c.includes(':') && !c.includes('/'));
    const text = plain.map((c) => /^text-(.+)$/.exec(c)?.[1]).find((t) => t && tailwindHex(t));
    const bg = plain.map((c) => /^bg-(.+)$/.exec(c)?.[1]).find((t) => t && tailwindHex(t));
    if (text && bg) {
      const ratio = contrastRatio(tailwindHex(text)!, tailwindHex(bg)!);
      if (ratio < 3) contrastHits.push({ ...h, label: `text-${text} on bg-${bg} has ${ratio.toFixed(1)}:1 contrast` });
    }
  }
  // Plain CSS: outline removed with no :focus-visible style anywhere in the file
  for (const f of styles) {
    const text = content(ctx, f);
    if (/:focus-visible/.test(text)) continue;
    for (const h of scan(ctx, [f], /outline\s*:\s*(none|0)\b/)) focusHits.push(h);
  }
  results.push(...(focusHits.length
    ? capped('ui-focus-hidden', focusHits, () => 'Focus outline removed with no visible replacement')
    : [{ checkId: 'ui-focus-hidden', status: 'pass' as const, message: 'Focus styles are kept or replaced' }]));
  results.push(...(contrastHits.length
    ? capped('ui-low-contrast', contrastHits, (h) => (h as Hit & { label: string }).label)
    : [{ checkId: 'ui-low-contrast', status: 'pass' as const, message: 'No low-contrast text and background pairs found' }]));

  // Viewport (Next.js, Nuxt, SvelteKit and Astro layouts add it; only check plain HTML entry files)
  const htmlPages = frontend.filter((f) => /\.html$/.test(f) && /<head[\s>]/i.test(content(ctx, f)) && !/(^|\/)public\/(?!index\.html$)/.test(f));
  const missingViewport = htmlPages.filter((f) => !/<meta[^>]+name=["']viewport["']/i.test(content(ctx, f)));
  for (const f of missingViewport.slice(0, MAX_PER_RULE)) {
    results.push({ checkId: 'ui-viewport', status: 'warn', message: 'No viewport meta tag: phones will render the desktop layout zoomed out', file: f });
  }
  const zoomBlocked = scan(ctx, [...htmlPages, ...scripts], /(?:user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b|userScalable\s*:\s*false|maximumScale\s*:\s*1\b)/);
  results.push(...capped('ui-viewport', zoomBlocked, () => 'Viewport blocks pinch-zoom: low-vision users cannot enlarge text'));
  if (!missingViewport.length && !zoomBlocked.length) results.push({ checkId: 'ui-viewport', status: 'pass', message: 'Viewport configured and zoom allowed' });

  // Title + description
  const hasTitle = /<title>[^<]+<\/title>|<title>\s*\{|<title>\s*\$|metadata[\s\S]{0,600}?\btitle\s*:|generateMetadata|useHead\(|useSeoMeta\(|<svelte:head>[\s\S]*?<title|\bdocument\.title\s*=|<Title\b/.test(all);
  const hasDescription = /name=["']description["']|metadata[\s\S]{0,1200}?\bdescription\s*:|generateMetadata|useSeoMeta\(|useHead\([\s\S]{0,400}description|name:\s*["']description["']/.test(all);
  if (!hasTitle || !hasDescription) {
    const missing = [!hasTitle && 'title', !hasDescription && 'meta description'].filter(Boolean).join(' and ');
    results.push({ checkId: 'ui-meta', status: 'warn', message: `No page ${missing} found: tabs and search results show a generic label` });
  } else {
    results.push({ checkId: 'ui-meta', status: 'pass', message: 'Page title and description set' });
  }

  // Favicon
  const hasFavicon =
    ctx.allFilePaths.some((f) => /(^|\/)(public|static|src|app)\/(favicon|icon|apple-icon)[\w.-]*\.(ico|png|svg|jpg|jpeg|tsx?|jsx?)$|(^|\/)favicon\.(ico|png|svg)$/.test(f)) ||
    /rel=["'](?:shortcut )?icon["']|icons\s*:\s*\{|icon\s*:\s*["'`]/.test(all);
  results.push(hasFavicon
    ? { checkId: 'ui-favicon', status: 'pass', message: 'Favicon present' }
    : { checkId: 'ui-favicon', status: 'warn', message: 'No favicon: tabs show a blank page icon' });

  // Open Graph image
  const hasOg =
    ctx.allFilePaths.some((f) => /(^|\/)(opengraph|twitter)-image\.(png|jpe?g|gif|tsx?|jsx?)$/.test(f)) ||
    /og:image|openGraph\s*:\s*\{[\s\S]{0,800}?images|twitter\s*:\s*\{[\s\S]{0,400}?images|ogImage/.test(all);
  results.push(hasOg
    ? { checkId: 'ui-og-image', status: 'pass', message: 'Link preview image configured' }
    : { checkId: 'ui-og-image', status: 'warn', message: 'No Open Graph image: shared links show a bare URL instead of a preview card' });

  // Fixed widths that overflow phones
  const wide: Hit[] = [];
  for (const h of scan(ctx, frontend, CLASS_STRING)) {
    const classes = (h.match[1] ?? h.match[2] ?? h.match[3] ?? h.match[4] ?? '').split(/\s+/);
    const fixed = classes.find((c) => {
      const m = /^(?:min-)?w-\[(\d+)px\]$/.exec(c);
      return m && Number(m[1]) >= 640;
    });
    if (fixed && !classes.some((c) => /^max-w-/.test(c))) wide.push({ ...h, match: /\[(\d+)px\]/.exec(fixed)! });
  }
  for (const h of scan(ctx, frontend, /style=\{\{[^}]*?\b(?:minWidth|width)\s*:\s*['"]?(\d{3,4})(?:px)?['"]?/)) {
    if (Number(h.match[1]) >= 640) wide.push(h);
  }
  results.push(...(wide.length
    ? capped('ui-fixed-width', wide, (h) => `Fixed width of ${h.match[1]}px will overflow phone screens`)
    : [{ checkId: 'ui-fixed-width', status: 'pass' as const, message: 'No large fixed widths found' }]));

  // Font sprawl
  const fonts = new Set<string>();
  const addFont = (name: string) => {
    const n = name.trim().replace(/^['"]|['"]$/g, '').replace(/[_+]/g, ' ').replace(/\s+Variable$/i, '').toLowerCase();
    if (n && !GENERIC_FONTS.has(n) && !n.startsWith('var(') && !n.startsWith('--') && !/^\$|^theme\(/.test(n)) fonts.add(n);
  };
  for (const m of all.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g)) m[1].split(',').forEach((n) => addFont(n.split(/\s+as\s+/)[0]));
  for (const m of all.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'`\s)]*/g)) for (const f of m[0].matchAll(/family=([^:&;"']+)/g)) addFont(decodeURIComponent(f[1]));
  for (const m of all.matchAll(/font-family\s*:\s*([^;}\n]+)/g)) addFont(m[1].split(',')[0]);
  for (const m of all.matchAll(/@fontsource(?:-variable)?\/([\w-]+)/g)) addFont(m[1].replace(/-/g, ' '));
  results.push(fonts.size > 3
    ? { checkId: 'ui-font-sprawl', status: 'warn', message: `${fonts.size} font families in use (${[...fonts].slice(0, 6).join(', ')}): pick two or three` }
    : { checkId: 'ui-font-sprawl', status: 'pass', message: `${fonts.size || 'No custom'} font famil${fonts.size === 1 ? 'y' : 'ies'} in use` });

  // Color sprawl (component files only; theme/token files are where colors belong)
  const colorFiles = frontend.filter((f) => /\.(jsx|tsx|vue|svelte|astro)$/.test(f) && !/tailwind\.config|theme|tokens?|colou?rs|palette/i.test(f));
  const hexes = new Map<string, number>();
  for (const f of colorFiles) {
    for (const m of content(ctx, f).matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![\w-])/g)) {
      let hex = m[0].toLowerCase();
      if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      hexes.set(hex, (hexes.get(hex) ?? 0) + 1);
    }
  }
  results.push(hexes.size > 25
    ? { checkId: 'ui-color-sprawl', status: 'warn', message: `${hexes.size} different hardcoded hex colors across components: move them into theme tokens` }
    : { checkId: 'ui-color-sprawl', status: 'pass', message: `${hexes.size} hardcoded colors in components` });

  // z-index wars
  const zHits = scan(ctx, [...frontend, ...styles, ...scripts.filter((f) => !frontend.includes(f))], /(?:\bz-\[(\d+)\]|\bzIndex\s*:\s*['"]?(\d+)|z-index\s*:\s*(\d+))/, (h) => Number(h.match[1] ?? h.match[2] ?? h.match[3]) >= 999);
  results.push(...(zHits.length
    ? capped('ui-z-index-war', zHits, (h) => `z-index ${h.match[1] ?? h.match[2] ?? h.match[3]}: use a small layering scale instead`)
    : [{ checkId: 'ui-z-index-war', status: 'pass' as const, message: 'No extreme z-index values' }]));

  return results;
}

// ---------------------------------------------------------------- other databases

const SERVER_DB_DRIVERS = /^(?:pg|mysql2(?:\/promise)?|postgres|@neondatabase\/serverless|@planetscale\/database|@libsql\/client|@prisma\/client|mongoose|mongodb|ioredis|redis|firebase-admin(?:\/[\w-]+)?|knex|drizzle-orm\/(?:node-postgres|mysql2|postgres-js))$/;

export function runOtherDatabaseChecks(ctx: RunnerCtx): CheckResult[] {
  const results: CheckResult[] = [];
  const deps = dependencyNames(ctx);
  const code = ctx.codeFiles.filter((f) => !NON_SOURCE.test(f));

  // --- Firebase ---
  const rulesFiles = ctx.allFilePaths.filter((f) => /(^|\/)[\w.-]*\.rules$|(^|\/)database\.rules\.json$/.test(f) && !NON_SOURCE.test(f));
  const usesFirebase = deps.has('firebase') || deps.has('firebase-admin') || ctx.allFilePaths.some((f) => /(^|\/)firebase\.json$/.test(f)) || rulesFiles.length > 0;
  if (usesFirebase) {
    const matches = [
      ...scan(ctx, rulesFiles.filter((f) => f.endsWith('.rules')), /allow\s+[\w\s,]+:\s*if\s+true\s*;|allow\s+(?:read|write|get|list|create|update|delete)(?:\s*,\s*\w+)*\s*;|request\.time\s*<\s*timestamp\.date\(/),
      ...scan(ctx, rulesFiles.filter((f) => f.endsWith('.json')), /"\.(?:read|write)"\s*:\s*(?:true|"true")/),
    ];
    // Public reads are often intentional (listings, images); public writes and test mode never are.
    const readOnly = (h: { match: RegExpMatchArray | RegExpExecArray }) => /^allow\s/.test(h.match[0]) && !/write|create|update|delete/.test(h.match[0]);
    const open = matches.filter((h) => !readOnly(h));
    const publicReads = matches.filter(readOnly);
    if (publicReads.length) {
      results.push(...capped('db-firebase-public-read', publicReads, () => 'Firebase rule makes this data readable by anyone: fine for public listings, never for user data'));
    }
    results.push(...(open.length
      ? capped('db-firebase-open-rules', open, (h) => (/request\.time/.test(h.match[0]) ? 'Firebase rules still in test mode: open to everyone until they expire' : 'Firebase rules allow anyone to read or write'), 'fail')
      : [{ checkId: 'db-firebase-open-rules', status: 'pass' as const, message: rulesFiles.length ? 'Firebase rules do not allow public access' : 'No open Firebase rules found' }]));

    const authOnly = scan(ctx, rulesFiles.filter((f) => f.endsWith('.rules')), /match\s+\/\{document=\*\*\}\s*\{[^}]*?allow\s+[\w\s,]+:\s*if\s+request\.auth\s*!=\s*null\s*;/);
    results.push(...capped('db-firebase-auth-only', authOnly, () => 'Any signed-in user can read and write every document'));

    const usesData = /getFirestore|getDatabase|getStorage|firestore\(\)|firebase\/(firestore|database|storage)/.test(ctx.codeJoined);
    if (usesData && rulesFiles.length === 0) {
      results.push({ checkId: 'db-firebase-no-rules', status: 'warn', message: 'Firebase data APIs used but no firestore.rules / storage.rules / database.rules.json in the repo' });
    }
  }

  // --- MongoDB / Mongoose ---
  const usesMongo = deps.has('mongoose') || deps.has('mongodb') || /from\s+['"](mongoose|mongodb)['"]|require\(['"](mongoose|mongodb)['"]\)/.test(ctx.codeJoined);
  if (usesMongo) {
    const injection = scan(
      ctx,
      code,
      /\.(?:find|findOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|updateOne|updateMany|deleteOne|deleteMany|countDocuments|exists)\(\s*(?:\{\s*\.\.\.)?(?:req|request|ctx\.request)\.(?:body|query|params)\b(?![.\[]\w)/,
    );
    results.push(...(injection.length
      ? capped('db-nosql-injection', injection, () => 'Mongo query built straight from request input: operator injection', 'fail')
      : [{ checkId: 'db-nosql-injection', status: 'pass' as const, message: 'No Mongo queries built directly from request input' }]));
    results.push(...capped('db-mongo-where', scan(ctx, code, /['"]?\$where['"]?\s*:/), () => '$where runs JavaScript inside MongoDB'));
  }

  // --- Prisma ---
  const prismaSchemas = ctx.allFilePaths.filter((f) => /\.prisma$/.test(f) && !NON_SOURCE.test(f));
  const hardcodedUrl = scan(ctx, prismaSchemas, /\b(?:url|directUrl|shadowDatabaseUrl)\s*=\s*"[^"]+"/, (h, text) => /datasource\s+\w+\s*\{/.test(text));
  results.push(...capped('db-prisma-hardcoded-url', hardcodedUrl, () => 'Database URL hardcoded in schema.prisma (password committed to git)', 'fail'));
  const routeFiles = code.filter((f) => /(^|\/)(app|src\/app)\/(.+\/)?route\.[jt]sx?$|(^|\/)pages\/api\/|(^|\/)(api|routes|controllers)\/|\+server\.[jt]s$/.test(f));
  const perRequest = scan(ctx, routeFiles, /new\s+PrismaClient\s*\(/, (h, text) => !/globalThis|global\.\w*prisma/i.test(text));
  results.push(...capped('db-client-per-request', perRequest, () => 'New PrismaClient created in a route handler: exhausts connections under load'));

  // --- Server drivers shipped to the browser ---
  const driverHits = scan(
    ctx,
    getClientFiles(ctx),
    /^[ \t]*import\s+(?!type\b)([^'"]*?)\s*from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/m,
    (h) => {
      const mod = h.match[2] ?? h.match[3] ?? '';
      if (!SERVER_DB_DRIVERS.test(mod)) return false;
      // `import { Post } from "@prisma/client"` brings in model types, which the compiler erases.
      // Only the client itself (PrismaClient) pulls the engine and connection into the bundle.
      if (mod === '@prisma/client') return /\bPrismaClient\b/.test(h.match[1] ?? '') || !!h.match[3];
      return true;
    },
  );
  results.push(...(driverHits.length
    ? capped('db-driver-in-client', driverHits, (h) => `Server database driver "${h.match[2] ?? h.match[3]}" imported in browser code`, 'fail')
    : [{ checkId: 'db-driver-in-client', status: 'pass' as const, message: 'No server database drivers in browser code' }]));

  // --- TLS disabled for remote databases ---
  const configish = ctx.allFilePaths.filter((f) => /\.(ts|js|mjs|cjs|json|ya?ml|toml|prisma)$|(^|\/)\.env\.(example|sample|template)$/.test(f) && !NON_SOURCE.test(f) && ctx.files.get(f));
  const noTls = scan(ctx, configish, /sslmode=disable|\bssl\s*:\s*false\b|\btls\s*=\s*false\b|\bssl\s*=\s*false\b/, (h, text) => !/localhost|127\.0\.0\.1|host\.docker\.internal|@(db|postgres|mysql|mongo|redis)[:/]/.test(h.snippet) && !(/\bssl\s*:\s*false\b/.test(h.snippet) && /localhost|127\.0\.0\.1/.test(text)));
  results.push(...capped('db-ssl-disabled', noTls, () => 'TLS disabled for a database connection: credentials cross the network in plain text'));

  // --- Convex ---
  const convexFiles = code.filter((f) => /(^|\/)convex\/(?!_generated\/)/.test(f));
  const publicMutations = convexFiles.filter((f) => /export\s+const\s+\w+\s*=\s*(?:mutation|action)\s*\(/.test(content(ctx, f)) && !/getUserIdentity|getAuthUserId|requireUser|requireAuth/.test(content(ctx, f)));
  for (const f of publicMutations.slice(0, MAX_PER_RULE)) {
    results.push({ checkId: 'db-convex-public-mutation', status: 'warn', message: 'Public Convex mutation/action with no auth check: anyone with the deployment URL can call it', file: f });
  }

  // --- PocketBase ---
  const pbFiles = ctx.allFilePaths.filter((f) => /(^|\/)pb_migrations\/.+\.(js|ts)$/.test(f));
  const pbOpen = scan(ctx, pbFiles, /["']?(createRule|updateRule|deleteRule|listRule|viewRule)["']?\s*[:=]\s*(["'])\2/);
  results.push(...capped('db-pocketbase-open-rule', pbOpen, (h) => (/^(create|update|delete)/.test(h.match[1]) ? `${h.match[1]} is "" so anyone can write` : `${h.match[1]} is "" so anyone can read`)));

  // --- Appwrite ---
  results.push(...capped('db-appwrite-public-write', scan(ctx, code, /Permission\.(?:write|update|delete)\(\s*Role\.any\(\)\s*\)/), () => 'Anyone (Role.any) can write, update or delete this resource'));

  return results;
}
