import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, warn, info } from '../types.js';

const REALTIME = /new\s+WebSocket\s*\(|io\s*\(|\.channel\s*\(|new\s+WebSocketServer|socket\.io|\bPusher\b|\bAbly\b|new\s+EventSource\s*\(/;
const CLEANUP = /unsubscribe|removeChannel|removeAllChannels|\.close\s*\(|\.disconnect\s*\(|\.off\s*\(|removeEventListener/;

/**
 * Check real-time connections (WebSocket, socket.io, Supabase Realtime, Pusher):
 * - Subscriptions are cleaned up (React effects return a cleanup)
 * - WebSocket servers authenticate connections
 * - Plaintext ws:// endpoints
 */
export function runRealtimeChecks(ctx: ProjectContext): CheckResult[] {
  const files = ctx.code.filter((f) => REALTIME.test(f.content));
  if (files.length === 0) {
    return [info('realtime/not-applicable', 'No real-time features detected — skipping real-time checks')];
  }

  const results: CheckResult[] = [];

  const leaky = files.filter((f) => /useEffect\s*\(/.test(f.content) && !CLEANUP.test(f.content));
  for (const f of leaky.slice(0, 5)) {
    results.push(warn('realtime/cleanup', 'low', 'Subscription opened in a React effect without cleanup — connections leak on every re-render', {
      file: f.rel, fix: 'Return a cleanup from useEffect: `return () => { supabase.removeChannel(channel) }`.',
    }));
  }
  if (leaky.length === 0) results.push(pass('realtime/cleanup', 'Real-time subscriptions are cleaned up'));

  const servers = files.filter((f) => /new\s+WebSocketServer|new\s+Server\s*\(|\.on\(\s*['"]connection['"]/.test(f.content));
  for (const f of servers) {
    if (!/verifyClient|handleUpgrade|token|auth|jwt|session|cookie/i.test(f.content)) {
      results.push(warn('realtime/server-auth', 'high', 'WebSocket server accepts connections without authentication', {
        file: f.rel, fix: 'Verify a token/session during the upgrade (verifyClient / io.use middleware) and reject unauthenticated sockets.',
      }));
    }
  }

  for (const m of ctx.grep(files, /['"`]ws:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/, { literals: true })) {
    results.push(warn('realtime/plaintext-ws', 'medium', 'Plaintext ws:// endpoint — use wss:// in production', { file: m.file, line: m.line, snippet: m.text }));
  }

  return results;
}
