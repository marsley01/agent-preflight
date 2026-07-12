import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult } from '../scan';

export async function runRealtimeChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const tsFiles = await glob(`${dir}/src/**/*.ts`, { ignore: ['**/node_modules/**', '**/.next/**'] });
  const realtimeFiles = tsFiles.filter(f => {
    const content = fs.readFileSync(f, 'utf-8');
    return (
      content.includes('websocket') ||
      content.includes('WebSocket') ||
      content.includes('ws://') ||
      content.includes('wss://') ||
      content.includes('socket') ||
      content.includes('subscription') ||
      content.includes('realtime') ||
      content.includes('supabase') && content.includes('channel') ||
      content.includes('broadcast') ||
      content.includes('presence')
    );
  });

  if (realtimeFiles.length === 0) {
    results.push({ status: 'warn', message: 'No real-time features detected \u2014 skipping real-time checks' });
    return results;
  }

  let hasCleanup = false;
  let cleanupFile: string | undefined;

  for (const file of realtimeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('unsubscribe') ||
      content.includes('unmount') ||
      content.includes('cleanup') ||
      content.includes('disconnect') ||
      content.includes('removeChannel') ||
      content.includes('destroy') ||
      content.includes('close()')
    ) {
      hasCleanup = true;
      cleanupFile = path.relative(dir, file);
      break;
    }
  }

  if (hasCleanup) {
    results.push({ status: 'pass', message: 'Real-time connection cleanup found', file: cleanupFile });
  } else {
    results.push({ status: 'warn', message: 'No real-time cleanup detected \u2014 connections may leak and cause memory issues' });
  }

  let hasReconnect = false;
  for (const file of realtimeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('reconnect') ||
      content.includes('retry') ||
      content.includes('backoff')
    ) {
      hasReconnect = true;
      break;
    }
  }

  results.push(
    hasReconnect
      ? { status: 'pass', message: 'Reconnection logic found for real-time connections' }
      : { status: 'warn', message: 'No reconnection logic detected \u2014 temporary network issues will drop connections permanently' }
  );

  let hasAuth = false;
  for (const file of realtimeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (
      content.includes('token') ||
      content.includes('auth') && (content.includes('channel') || content.includes('socket')) ||
      content.includes('accessToken')
    ) {
      hasAuth = true;
      break;
    }
  }

  results.push(
    hasAuth
      ? { status: 'pass', message: 'Authentication found on real-time connections' }
      : { status: 'warn', message: 'No authentication detected on real-time channels \u2014 anyone can connect' }
  );

  return results;
}
