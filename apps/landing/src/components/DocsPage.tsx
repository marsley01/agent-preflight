import React, { useEffect } from 'react';
import { Footer, Header } from './Header';
import { SearchModal } from './SearchModal';
import { Toast } from './Toast';
import { useShellState } from '../pages/DashboardPage';

const docsBody = `


<div class="max-w-[1280px] mx-auto px-4 sm:px-6 flex">
  <aside class="w-64 shrink-0 hidden lg:block sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto py-8 pr-6 border-r border-cockpit-border/50 text-sm">
    <div class="space-y-7">
      <div>
        <div class="px-3 mb-2 text-[11px] font-mono uppercase tracking-widest text-cockpit-muted flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 bg-cockpit-muted rounded-full"></span>
          <span class="">Getting Started</span>
        </div>
        <ul class="space-y-1 font-medium">
          <li><a href="#overview" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-bright bg-cockpit-850/80 border border-cockpit-border text-xs"><span>Overview</span></a></li>
          <li><a href="#getting-started" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors text-xs"><span>CLI Installation</span></a></li>
        </ul>
      </div>
      <div>
        <div class="px-3 mb-2 text-[11px] font-mono uppercase tracking-widest text-cockpit-muted flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 bg-cockpit-muted rounded-full"></span>
          <span class="">Check categories</span>
        </div>
        <ul class="space-y-1 font-mono text-xs">
          <li><a href="#security" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-status-fail"></span>Security</span></a></li>
          <li><a href="#auth" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-status-fail"></span>Auth</span></a></li>
          <li><a href="#database" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-status-fail"></span>Database (Supabase)</span></a></li>
          <li><a href="#payments" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-status-fail"></span>Payments</span></a></li>
          <li><a href="#api" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-status-warn"></span>API &amp; Endpoints</span></a></li>
          <li><a href="#performance" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-status-pass"></span>Performance</span></a></li>
        </ul>
      </div>
      <div>
        <div class="px-3 mb-2 text-[11px] font-mono uppercase tracking-widest text-cockpit-muted flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 bg-cockpit-muted rounded-full"></span>
          <span class="">Configuration &amp; CI</span>
        </div>
        <ul class="space-y-1 font-mono text-xs">
          <li><a href="#severity-levels" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span>Severity Levels</span></a></li>
          <li><a href="#ignoring-a-check" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span>Ignoring a Check</span></a></li>
          <li><a href="#contributing" class="flex items-center justify-between px-3 py-1.5 rounded-md text-cockpit-text hover:text-cockpit-bright hover:bg-cockpit-900/60 transition-colors"><span>Contributing</span></a></li>
        </ul>
      </div>
    </div>
  </aside>

  <main class="flex-1 min-w-0 py-8 lg:pl-10 xl:pl-14 space-y-16">
    <section id="overview" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12">
      <div class="flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-status-pass mb-2">
        <span class="w-2 h-2 rounded-full bg-status-pass animate-pulse"></span>
        <span>The checks behind every Preflight scan</span>
      </div>
      <h1 class="font-syne font-bold text-3xl sm:text-4xl text-cockpit-bright tracking-tight mb-4">Preflight Documentation</h1>
      <p class="text-base sm:text-lg text-cockpit-bright/90 leading-relaxed max-w-3xl font-normal">Preflight looks at your code, not your deployed site, and checks it for the mistakes that break AI-built apps. It runs in seconds, and nothing leaves your machine unless you use the "paste a repo link" option above.</p>
      <div class="mt-6 p-4 rounded-lg bg-cockpit-900 border border-cockpit-border max-w-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="text-xs font-mono text-cockpit-muted mb-1">QUICK START</div>
          <code class="font-mono text-sm text-status-pass font-medium select-all">$ npx @preflight-agent/cli scan</code>
        </div>
        <a href="/" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-bright text-cockpit-950 text-sm font-medium hover:opacity-90 transition-opacity">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          Scan a repo
        </a>
      </div>
    </section>

    <section id="getting-started" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Getting Started</h2></div>
      <p class="text-sm sm:text-base leading-relaxed max-w-3xl">Preflight walks through your Next.js route handlers, server actions, client components, and Supabase SQL migrations, checking each against its rules. It finishes in seconds, right on your machine.</p>
      <div class="space-y-4 max-w-3xl">
        <div class="rounded-lg bg-cockpit-900 border border-cockpit-border overflow-hidden">
          <div class="px-4 py-2 border-b border-cockpit-borderSubtle bg-cockpit-850/60 flex items-center justify-between text-xs font-mono"><span class="text-cockpit-bright">1. Run locally in repo root</span><span class="text-cockpit-muted">terminal</span></div>
          <div class="p-4 font-mono text-xs text-cockpit-bright bg-cockpit-950 overflow-x-auto"><span class="text-cockpit-muted"># Execute root scan across /app, /pages, and /supabase/migrations</span><br><span class="text-status-pass">$</span> npx @preflight-agent/cli scan<br><br><span class="text-cockpit-muted"># Optional: scan another directory, or only some categories</span><br><span class="text-status-pass">$</span> npx @preflight-agent/cli scan ./my-app --only database,security</div>
        </div>
        <div class="rounded-lg bg-cockpit-900 border border-cockpit-border overflow-hidden">
          <div class="px-4 py-2 border-b border-cockpit-borderSubtle bg-cockpit-850/60 flex items-center justify-between text-xs font-mono"><span class="text-cockpit-bright">2. GitHub Actions CI Integration</span><span class="text-cockpit-muted">.github/workflows/preflight.yml</span></div>
          <div class="p-4 font-mono text-xs text-cockpit-bright bg-cockpit-950 overflow-x-auto leading-relaxed"><span class="text-cockpit-muted">name:</span> Preflight Verification<br><span class="text-cockpit-muted">on:</span> [pull_request, push]<br><span class="text-cockpit-muted">jobs:</span><br>&nbsp;&nbsp;<span class="text-cockpit-muted">verify:</span><br>&nbsp;&nbsp;&nbsp;&nbsp;<span class="text-cockpit-muted">runs-on:</span> ubuntu-latest<br>&nbsp;&nbsp;&nbsp;&nbsp;<span class="text-cockpit-muted">steps:</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- <span class="text-cockpit-muted">uses:</span> actions/checkout@v4<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- <span class="text-cockpit-muted">run:</span> npx -y @preflight-agent/cli scan --fail-on high</div>
        </div>
      </div>
    </section>

    <section id="security" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div class="flex items-center justify-between max-w-4xl">
        <div><div class="flex items-center gap-2 text-xs font-mono text-status-fail mb-1"><span class="w-2 h-2 rounded-full bg-status-fail"></span><span>SECURITY: EXPLOITABLE BY DEFAULT</span></div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Security Checks</h2></div>
      </div>
      <p class="text-sm sm:text-base leading-relaxed max-w-4xl">Checks covering secret exposure, leaking credentials, permissive access headers, and sensitive debug traces before code is pushed to remotes or bundled into client assets.</p>
      <div class="space-y-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Hardcoded API keys or secrets committed to source</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">SEC-001: HARDCODED_PLAINTEXT_SECRET</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">A developer pastes a key directly into a file to "get it working," forgets to move it to <code class="font-mono text-cockpit-bright bg-cockpit-850 px-1 py-0.5 rounded text-xs">.env</code>. Anyone with repo access, or anyone who finds the repo public, has it.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Automated secret scanners run by bots indexing public commits within seconds, or an unauthorized collaborator.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">.env files committed to git history</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">SEC-002: ENV_IN_GIT_HISTORY</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Removing the file in a later commit doesn't remove it from history; it's still pullable by anyone who clones the repository tree.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Security auditors reviewing git log revisions or attackers cloning public repositories during reconnaissance.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Supabase service_role key referenced in client-side / bundled file</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">SEC-003: SUPABASE_SERVICE_ROLE_CLIENT_LEAK</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">This key bypasses Row Level Security entirely. If it ships in the client JS bundle (e.g. exposed via <code class="font-mono text-cockpit-bright bg-cockpit-850 px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_</code> or directly referenced in a component without <code class="font-mono text-cockpit-bright bg-cockpit-850 px-1 py-0.5 rounded text-xs">'use server'</code>), anyone can open browser DevTools and read or overwrite your entire database.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Anyone deliberately probing network payloads or searching source maps in production dev tools.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Wildcard CORS (Access-Control-Allow-Origin: *) on authenticated endpoints</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">SEC-004: WILDCARD_CORS_USER_DATA</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Configuring wildcard origins on endpoints that return private user data allows arbitrary third-party websites visited by an authenticated user to make requests and read personal data.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Malicious domains executing CSRF/CORS exploits on unsuspecting signed-in visitors.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Verbose error responses leaking stack traces or internal file paths</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">SEC-005: VERBOSE_ERROR_LEAK</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Returning unhandled exception messages or internal file paths (<code class="font-mono text-xs">/var/task/...</code>) directly in JSON responses provides attackers an architectural blueprint of the backend environment.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Security researchers fuzzing malformed query payloads or penetration testers mapping endpoints.</span></div></div>
        </div>
      </div>
    </section>

    <section id="auth" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div class="flex items-center justify-between max-w-4xl">
        <div><div class="flex items-center gap-2 text-xs font-mono text-status-fail mb-1"><span class="w-2 h-2 rounded-full bg-status-fail"></span><span>IDENTITY &amp; SESSION GATES</span></div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Auth Checks</h2></div>
      </div>
      <p class="text-sm sm:text-base leading-relaxed max-w-4xl">Verifies server-side authorization boundaries, preventing client-only gate bypasses, cookie exfiltration, and unbound authentication tokens.</p>
      <div class="space-y-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">API routes with no session check</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">AUTH-001: UNGUARDED_ROUTE_HANDLER</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Route handlers in Next.js <code class="font-mono text-xs text-cockpit-bright bg-cockpit-850 px-1 py-0.5 rounded">app/api/*/route.ts</code> that do not resolve the active session with Supabase auth or NextAuth. The endpoint executes for anyone who hits the URL.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Anyone inspecting the network tab in production and sending a cURL request without headers.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Role checks done only in frontend UI components</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">AUTH-002: CLIENT_ONLY_ROLE_EVALUATION</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Writing <code class="font-mono text-xs text-cockpit-bright bg-cockpit-850 px-1 py-0.5 rounded">if (user.role === 'admin')</code> inside a React client component. The check never executes on the server side, allowing any authenticated or unauthenticated user to call the underlying API route directly.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> A non-admin user who modifies local state with React DevTools or triggers the endpoint via HTTP client.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Session cookies missing httpOnly, secure, or SameSite flags</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">AUTH-003: INSECURE_SESSION_COOKIE_ATTRS</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Omitting strict cookie flags leaves session tokens accessible via JavaScript execution (<code class="font-mono text-xs">document.cookie</code>) or vulnerable to cross-site request replay attacks.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> An injected cross-site script (XSS) from an unvetted npm dependency exfiltrating auth tokens.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Password reset or magic link tokens with no expiry or reusable state</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">AUTH-004: UNBOUND_VERIFICATION_TOKEN</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Generating verification links that do not mark tokens as consumed upon first verification, or omitting a strict timestamp expiration ceiling (e.g. 15 minutes).</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> An attacker with temporary access to an email inbox or proxy log re-using an expired invite link days later.</span></div></div>
        </div>
      </div>
    </section>

    <section id="database" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div class="flex items-center justify-between max-w-4xl">
        <div><div class="flex items-center gap-2 text-xs font-mono text-status-fail mb-1"><span class="w-2 h-2 rounded-full bg-status-fail"></span><span>POSTGRESQL &amp; SUPABASE RLS</span></div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Database Checks</h2></div>
      </div>
      <p class="text-sm sm:text-base leading-relaxed max-w-4xl">Audits SQL migration files and Supabase client queries for missing table policies, permissive bypasses, and untrusted client assertions.</p>
      <div class="space-y-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Row Level Security disabled on a table entirely</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">DB-001: RLS_DISABLED</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">When RLS is not enabled on a table in Supabase (<code class="font-mono text-xs">ALTER TABLE ... ENABLE ROW LEVEL SECURITY</code>), the default public <code class="font-mono text-xs text-status-cyan">anon</code> key has full SELECT, INSERT, UPDATE, and DELETE privileges across all records.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Anyone using the standard PostgREST endpoint (<code class="font-mono text-xs text-status-cyan">/rest/v1/your_table</code>) with your anon public API key.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">RLS policy written as USING (true)</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">DB-002: PERMISSIVE_USING_TRUE_POLICY</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Technically enabled on the table, but functionally identical to disabled. Grants universal access to every row without scoping to the authenticated user ID or tenant organization.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> A competitor or scraping script querying your public Supabase REST schema directly.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Policies trusting a client-supplied field rather than auth session</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">DB-003: CLIENT_SUPPLIED_USER_ID_TRUST</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Policies that check a <code class="font-mono text-xs">user_id</code> sent in the request body or parameters rather than comparing against the cryptographically verified <code class="font-mono text-xs text-status-cyan">auth.uid()</code> from the Supabase JWT session.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Any user who changes the <code class="font-mono text-xs">user_id</code> value in their request payload to another user's UUID and mutates their data.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Client code writing directly to tables that should mutate via server</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">DB-004: DIRECT_CLIENT_MUTATION</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Browser-side components calling <code class="font-mono text-xs">supabase.from('subscriptions').insert(...)</code> directly without going through a validated Next.js Server Action or database trigger with business logic checks.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> An engineer investigating inconsistent state when users trigger partial mutations that bypass backend side-effects.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">SELECT * queries returning internal columns to client</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">DB-005: WILDCARD_SELECT_DATA_EXPOSURE</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Queries using wildcard column extraction (<code class="font-mono text-xs">.select('*')</code>) on user or admin tables that return password hashes, internal status flags, or secondary metadata to the browser network tab.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Users observing excessive JSON payload structures in browser developer tools.</span></div></div>
        </div>
      </div>
    </section>

    <section id="payments" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div class="flex items-center justify-between max-w-4xl">
        <div><div class="flex items-center gap-2 text-xs font-mono text-status-fail mb-1"><span class="w-2 h-2 rounded-full bg-status-fail"></span><span>TRANSACTION INTEGRITY</span></div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Payments Checks</h2></div>
      </div>
      <p class="text-sm sm:text-base leading-relaxed max-w-4xl">Scrutinizes webhook listeners, idempotency guarantees, client price assertions, and transaction audit trails across Stripe, LemonSqueezy, and mobile carriers (M-Pesa STK push).</p>
      <div class="space-y-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Webhook endpoints with no signature or origin verification</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PAY-001: UNVERIFIED_WEBHOOK_SIGNATURE</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Callback endpoints (such as Stripe, LemonSqueezy, or M-Pesa STK Push) that parse the incoming JSON payload without verifying the cryptographic HMAC signature header (<code class="font-mono text-xs">stripe-signature</code>) against the signing secret. Anyone can POST a forged "payment successful" event and get their account credited.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Anyone inspecting webhook URLs or sending fabricated HTTP POST payloads to grant themselves paid plan status for free.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">No idempotency handling on webhook processing</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PAY-002: MISSING_IDEMPOTENCY_KEY</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Payment gateways routinely retry callbacks on transient network timeouts. If your handler does not store and check event IDs (<code class="font-mono text-xs">evt_...</code>), the same event fired twice will increment credit balances or provision duplicate records twice.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> The developer dealing with duplicate subscription charges or confused users during upstream gateway retry flurries.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Amount or currency read from client request instead of server order</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PAY-003: CLIENT_SUPPLIED_PRICE_ASSERTION</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Reading the purchase amount or currency directly from the client request payload rather than fetching the authoritative price on the server from the product catalog. A user can change the number in browser dev tools before it hits your checkout creation callback.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> The founder checking their Stripe dashboard seeing an order completed for $0.01 instead of $99.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">No audit trail on payment state changes</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PAY-004: MISSING_PAYMENT_AUDIT_LOG</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Directly updating a user table's <code class="font-mono text-xs">is_subscribed</code> flag without recording immutable event entries (gateway transaction ID, timestamp, raw payload hash). When a chargeback or refund dispute occurs, there is zero historical trace.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Support engineers unable to determine why a subscription was canceled when a customer files a dispute.</span></div></div>
        </div>
      </div>
    </section>

    <section id="api" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div class="flex items-center justify-between max-w-4xl">
        <div><div class="flex items-center gap-2 text-xs font-mono text-status-warn mb-1"><span class="w-2 h-2 rounded-full bg-status-warn"></span><span>ROUTE HARDENING &amp; BOUNDS</span></div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">API Checks</h2></div>
      </div>
      <p class="text-sm sm:text-base leading-relaxed max-w-4xl">Evaluates endpoint rate throttling, schema validation with Zod/ArkType, unbounded listing queries, and memory exhaustion vectors.</p>
      <div class="space-y-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">No rate limiting on public endpoints</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">API-001: UNTHROTTLED_PUBLIC_ROUTE</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Public API routes lacking IP or token bucket rate limiting (e.g. Upstash Redis, Cloudflare Rate Limiting). Vulnerable to scraping, credential stuffing, and LLM inference cost spikes.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Scraping bots or automated credential-stuffing tools inflating serverless function bills.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-fail"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Missing input validation (raw strings into queries or unescaped output)</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">API-002: UNVALIDATED_INPUT_TAINT</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Route handlers taking query parameters or JSON bodies directly into raw SQL template strings (SQL injection) or returning user-provided HTML without sanitization (XSS).</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Penetration testing tools or attackers passing quotation marks and SQL clauses into form fields.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Unpaginated list endpoints</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">API-003: UNBOUNDED_LIST_QUERY</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Endpoints returning an entire database table with no <code class="font-mono text-xs">LIMIT</code> or cursor pagination. As table rows grow past 10,000, a single request exhausts server memory and presents an easy bulk data exfiltration vector.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Your edge functions crashing with 504 Gateway Timeout errors when table volume grows.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">No request size limits configured</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">API-004: UNCONSTRAINED_PAYLOAD_SIZE</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Omitting payload limits on JSON body parsers or upload handlers allows adversaries to trigger out-of-memory denial of service by submitting 50MB HTTP payloads.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> The infrastructure engineer investigating random worker node terminations.</span></div></div>
        </div>
      </div>
    </section>

    <section id="performance" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div class="flex items-center justify-between max-w-4xl">
        <div><div class="flex items-center gap-2 text-xs font-mono text-status-pass mb-1"><span class="w-2 h-2 rounded-full bg-status-pass"></span><span>ENGINE VELOCITY &amp; WATERFALLS</span></div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Performance Checks</h2></div>
      </div>
      <p class="text-sm sm:text-base leading-relaxed max-w-4xl">Flags database serialization bottlenecks, missing indexes, unoptimized image pipelines, and serial waterfall latency traps in React Server Components.</p>
      <div class="space-y-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">N+1 query patterns inside loops</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PERF-001: ASYNC_LOOP_DATABASE_N_PLUS_1</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Calling database queries or Supabase client fetches inside <code class="font-mono text-xs">for...of</code> loops or <code class="font-mono text-xs">.map(async (item) =&gt; ...)</code> rather than batching with single SQL <code class="font-mono text-xs">IN (...)</code> clauses or relational joins.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Your end users waiting 4+ seconds for a dashboard to render as 80 serial queries hit the database.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Missing indexes on columns used in frequent WHERE or JOIN clauses</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PERF-002: UNINDEXED_FOREIGN_KEYS</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Foreign key columns (e.g. <code class="font-mono text-xs">organization_id</code>, <code class="font-mono text-xs">user_id</code>) and status columns lacking indexes. Forces PostgreSQL to execute full sequential table scans on every query.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> The database administrator watching CPU metrics peg at 100% during traffic surges.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-pass"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Full-resolution images shipped with no resizing or lazy loading</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PERF-003: UNOPTIMIZED_IMAGE_ASSETS</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Using unconstrained <code class="font-mono text-xs">&lt;img&gt;</code> tags loading 6MB camera raw exports or uncompressed PNGs rather than Next.js <code class="font-mono text-xs">&lt;Image&gt;</code> with WebP/AVIF transcoding and viewport lazy-loading.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Mobile users on high-latency cell networks dropping off due to 12-second Largest Contentful Paint (LCP) times.</span></div></div>
        </div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-cockpit-border space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-status-warn"></span><h3 class="font-syne font-semibold text-base text-cockpit-bright">Sequential data-fetching waterfalls where requests could run in parallel</h3></div>
              <code class="text-xs font-mono text-cockpit-muted mt-0.5 inline-block">PERF-004: RSC_SEQUENTIAL_AWAIT_WATERFALL</code>
            </div>
          </div>
          <p class="text-sm text-cockpit-text leading-relaxed">Writing multiple sequential <code class="font-mono text-xs">await</code> statements in a single server component for independent data calls (e.g. <code class="font-mono text-xs">const user = await getUser(); const org = await getOrg();</code>) instead of concurrent execution via <code class="font-mono text-xs text-status-cyan">Promise.all()</code>.</p>
          <div class="p-3 rounded bg-cockpit-950 border border-cockpit-borderSubtle text-xs font-mono space-y-1"><div class="text-status-warn flex items-center gap-1.5"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><span><strong>Who finds this if Preflight doesn't:</strong> Cumulative Time-To-First-Byte (TTFB) latency stacking up in APM telemetry charts.</span></div></div>
        </div>
      </div>
    </section>

    <section id="severity-levels" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div><div class="text-xs font-mono text-cockpit-muted uppercase tracking-wider mb-1">TELEMETRY STATUS SYSTEM</div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Severity Levels</h2></div>
      <p class="text-sm sm:text-base leading-relaxed max-w-3xl">Preflight adheres to an aviation cockpit annunciator panel model with deterministic tri-state status indicators:</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        <div class="p-5 rounded-lg bg-cockpit-900 border border-status-fail/30 relative overflow-hidden"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-status-fail shadow-[0_0_10px_#ef4444]"></span><span class="font-mono font-bold text-status-fail text-sm">RED // FAIL</span></div></div><h4 class="font-syne font-semibold text-cockpit-bright text-base mb-1">Blocks Deploy Recommendation</h4><p class="text-xs text-cockpit-text leading-relaxed">Critical security or transactional leak. Examples include public service role keys, open RLS without auth checks, and unverified payment webhooks. Fails CI gate automatically.</p></div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-status-warn/30 relative overflow-hidden"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-status-warn shadow-[0_0_10px_#f59e0b]"></span><span class="font-mono font-bold text-status-warn text-sm">AMBER // WARN</span></div></div><h4 class="font-syne font-semibold text-cockpit-bright text-base mb-1">Should Fix / Non-Blocking</h4><p class="text-xs text-cockpit-text leading-relaxed">Architectural risks, missing indexes, unpaginated lists, or verbose error traces. Highlighted prominently in terminal stdout but does not halt deployment pipelines by default.</p></div>
        <div class="p-5 rounded-lg bg-cockpit-900 border border-status-pass/30 relative overflow-hidden"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-status-pass shadow-[0_0_10px_#16a34a]"></span><span class="font-mono font-bold text-status-pass text-sm">PASSED</span></div></div><h4 class="font-syne font-semibold text-cockpit-bright text-base mb-1">Check passed</h4><p class="text-xs text-cockpit-text leading-relaxed">Rule invariant satisfied. Verified cryptographic signatures, scoped RLS with tenant boundaries, secure cookie directives, and rate-limited public routes.</p></div>
      </div>
    </section>

    <section id="ignoring-a-check" class="scroll-mt-20 border-b border-cockpit-border/60 pb-12 space-y-6">
      <div><div class="text-xs font-mono text-cockpit-muted uppercase tracking-wider mb-1">CONFIGURATION DIRECTIVES</div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Ignoring a Check</h2></div>
      <p class="text-sm sm:text-base leading-relaxed max-w-3xl">To suppress a diagnostic, specify an inline suppression comment directly above the flagged line, or exclude whole paths in a <code class="font-mono text-xs">.preflightignore</code> file. <strong>Always write the reason</strong> so it is visible in code review.</p>
      <div class="space-y-4 max-w-3xl">
        <div class="rounded-lg bg-cockpit-900 border border-cockpit-border overflow-hidden"><div class="px-4 py-2 border-b border-cockpit-borderSubtle bg-cockpit-850/60 flex items-center justify-between text-xs font-mono"><span class="text-cockpit-bright">Inline Comment Syntax (Reason Required)</span><span class="text-cockpit-muted">TypeScript / SQL</span></div><div class="p-4 font-mono text-xs text-cockpit-bright bg-cockpit-950 overflow-x-auto leading-relaxed"><span class="text-cockpit-muted">// preflight-ignore: fixture key, only used by the test suite</span><br><span class="text-cockpit-bright">const TEST_KEY = 'sk_test_...';</span><br><br><span class="text-cockpit-muted">-- Applies to the same line or the line directly below.</span></div></div>
        <div class="rounded-lg bg-cockpit-900 border border-cockpit-border overflow-hidden"><div class="px-4 py-2 border-b border-cockpit-borderSubtle bg-cockpit-850/60 flex items-center justify-between text-xs font-mono"><span class="text-cockpit-bright">Path Exclusions</span><span class="text-cockpit-muted">.preflightignore</span></div><div class="p-4 font-mono text-xs text-cockpit-bright bg-cockpit-950 overflow-x-auto leading-relaxed"><span class="text-cockpit-muted"># gitignore-style globs, one per line</span><br><span class="text-cockpit-muted"># public health ping, exposes no tenant data</span><br><span class="text-cockpit-bright">app/api/public-health/</span><br><span class="text-cockpit-bright">scripts/seed/</span><br><span class="text-cockpit-bright">**/*.generated.ts</span></div></div>
      </div>
    </section>

    <section id="contributing" class="scroll-mt-20 pb-16 space-y-6">
      <div><div class="text-xs font-mono text-cockpit-muted uppercase tracking-wider mb-1">OPEN SOURCE LICENSE</div><h2 class="font-syne font-bold text-2xl text-cockpit-bright">Contributing</h2></div>
      <div class="p-6 rounded-lg bg-cockpit-900 border border-cockpit-border max-w-3xl space-y-4">
        <p class="text-sm sm:text-base leading-relaxed text-cockpit-bright font-normal">Preflight is free and open-source software distributed under the <strong>MIT License</strong>. We have zero telemetry lock-in and zero commercial upsells.</p>
        <p class="text-sm leading-relaxed text-cockpit-text">Issues and PRs welcome. If Preflight misses a real problem or flags something safe, open an issue with a minimal example.</p>
        <div class="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
          <a href="https://github.com/marsley01/agent-preflight" target="_blank" rel="noreferrer" class="px-3.5 py-2 rounded bg-cockpit-850 hover:bg-cockpit-800 border border-cockpit-border text-cockpit-bright transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path></svg>
            <span>github.com/marsley01/agent-preflight</span>
          </a>
          <span class="text-cockpit-muted">MIT License</span>
        </div>
      </div>
    </section>

    
  </main>
</div>
`;

/** /docs: static reference content inside the same shell (header, search, footer) as the app. */
const DocsPage: React.FC = () => {
  const { navigate, isSearchOpen, setIsSearchOpen, toastMessage, setToastMessage } = useShellState();
  const goTab = (tab: string) => navigate(tab === 'scan' ? '/' : `/?tab=${tab}`);

  useEffect(() => {
    document.title = 'Docs | Preflight';
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-on-surface">
      <Header activeTab="docs" onTabChange={goTab} onOpenSearch={() => setIsSearchOpen(true)} />
      <SearchModal
        isOpen={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onSelectPath={(path) => (path === '/docs' ? window.scrollTo({ top: 0 }) : goTab(path))}
      />
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      {/* Static, author-controlled HTML (no user input), so innerHTML is safe here. */}
      <div className="flex-1 text-cockpit-text" dangerouslySetInnerHTML={{ __html: docsBody }} />
      <Footer />
    </div>
  );
};

export default DocsPage;
