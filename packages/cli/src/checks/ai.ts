import type { ProjectContext } from '../context.js';
import { type CheckResult, pass, fail, warn, info } from '../types.js';
import { isClientFile } from './security.js';

const LLM_DEPS = ['openai', '@anthropic-ai/sdk', 'ai', 'groq-sdk', '@mistralai/mistralai', 'cohere-ai', 'ollama', 'llamaindex', '@google/generative-ai', '@google/genai', 'replicate', 'together-ai', /^@ai-sdk\//, /^@langchain\//, /^langchain$/];
const LLM_CALL = /\.(chat\.completions|completions|messages|responses)\.create\s*\(|\b(generateText|streamText|generateObject|streamObject)\s*\(|\.generateContent\s*\(|\.invoke\s*\(/;

/**
 * Checks for apps that call LLM APIs:
 * - Provider SDK used directly from the browser (key exposure)
 * - User input interpolated into the system prompt (prompt injection)
 * - Output token limits (cost control)
 * - Model output executed or rendered as HTML
 */
export function runAiChecks(ctx: ProjectContext): CheckResult[] {
  if (!ctx.hasDependency(...LLM_DEPS)) {
    return [info('ai/not-applicable', 'No LLM SDK detected — skipping AI checks')];
  }

  const results: CheckResult[] = [];

  for (const m of ctx.grep(ctx.code, /dangerouslyAllowBrowser\s*:\s*true/)) {
    results.push(fail('ai/browser-key', 'critical', 'LLM SDK used from the browser — your API key ships to every visitor', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Call the model from a server route and stream the result to the client.',
    }));
  }
  const clientCalls = ctx.code.filter((f) => isClientFile(ctx, f) && LLM_CALL.test(f.content) && /new\s+(OpenAI|Anthropic|Groq)\s*\(/.test(f.content));
  for (const f of clientCalls) {
    results.push(fail('ai/browser-key', 'critical', 'LLM client constructed in client-side code', { file: f.rel }));
  }

  const injected = ctx.grep(ctx.code, /(system|systemPrompt|system_prompt|role:\s*['"]system['"],\s*content)\s*:\s*`[^`]*\$\{[^}]*(input|query|message|prompt|body|user|req)/i);
  for (const m of injected.slice(0, 5)) {
    results.push(warn('ai/prompt-injection', 'medium', 'User input interpolated into the system prompt — prompt injection can override your instructions', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Keep the system prompt static; pass user content as a separate user message, delimited and treated as data.',
    }));
  }

  const callers = ctx.code.filter((f) => LLM_CALL.test(f.content));
  if (callers.length > 0) {
    const unbounded = callers.filter((f) => !/max_tokens|maxTokens|maxOutputTokens|max_output_tokens|max_completion_tokens/.test(f.content));
    for (const f of unbounded.slice(0, 5)) {
      results.push(warn('ai/token-limit', 'low', 'LLM call without an output token limit — one prompt can run up your bill', {
        file: f.rel, fix: 'Set max_tokens / maxOutputTokens on every call.',
      }));
    }
    if (unbounded.length === 0) results.push(pass('ai/token-limit', 'Output token limits set on LLM calls'));
  }

  const execOutput = ctx.grep(ctx.code, /(eval|new\s+Function|exec|execSync)\s*\(\s*[^)]*(completion|response|result|output|text|content)\b/);
  for (const m of execOutput.slice(0, 5)) {
    if (!LLM_CALL.test(ctx.files.get(m.file)!.content)) continue;
    results.push(fail('ai/exec-output', 'critical', 'Model output passed to eval/exec — prompt injection becomes remote code execution', {
      file: m.file, line: m.line, snippet: m.text,
      fix: 'Never execute model output directly. Run generated code in a sandbox (e.g. a microVM) with no secrets.',
    }));
  }

  if (results.length === 0) results.push(pass('ai/basics', 'No obvious LLM integration issues'));
  return results;
}
