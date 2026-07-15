import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode, SplitSquareHorizontal, Columns2, Copy, Check, AlertTriangle, Shield, ArrowRight } from 'lucide-react';

type ViewMode = 'split' | 'unified';

interface DiffLine {
  type: 'context' | 'removed' | 'added';
  leftNum: number | null;
  rightNum: number | null;
  content: string;
}

const vulnerableCode = [
  'import { NextRequest, NextResponse } from "next/server";',
  'import OpenAI from "openai";',
  '',
  'const openai = new OpenAI({',
  '  apiKey: process.env.OPENAI_API_KEY!',
  '});',
  '',
  'export async function POST(req: NextRequest) {',
  '  const { prompt } = await req.json();',
  '',
  '  const completion = await openai.chat.completions.create({',
  '    model: "gpt-4",',
  '    messages: [{ role: "user", content: prompt }],',
  '  });',
  '',
  '  return NextResponse.json({',
  '    reply: completion.choices[0].message.content,',
  '  });',
  '}',
];

const fixedCode = [
  'import { NextRequest, NextResponse } from "next/server";',
  'import OpenAI from "openai";',
  'import { Ratelimit } from "@upstash/ratelimit";',
  'import { Redis } from "@upstash/redis";',
  '',
  'const openai = new OpenAI({',
  '  apiKey: process.env.OPENAI_API_KEY!',
  '});',
  '',
  'const ratelimit = new Ratelimit({',
  '  redis: Redis.fromEnv(),',
  '  limiter: Ratelimit.slidingWindow(10, "1 m"),',
  '  analytics: true,',
  '});',
  '',
  'export async function POST(req: NextRequest) {',
  '  const { prompt } = await req.json();',
  '  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";',
  '  const { success, limit, reset } = await ratelimit.limit(ip);',
  '',
  '  if (!success) {',
  '    return NextResponse.json(',
  '      { error: "Too many requests. Please slow down." },',
  '      { status: 429, headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Reset": String(reset) } },',
  '    );',
  '  }',
  '',
  '  const completion = await openai.chat.completions.create({',
  '    model: "gpt-4",',
  '    messages: [{ role: "user", content: prompt }],',
  '  });',
  '',
  '  return NextResponse.json({',
  '    reply: completion.choices[0].message.content,',
  '  });',
  '}',
];

function buildDiff(): DiffLine[] {
  const lines: DiffLine[] = [];
  let li = 0;
  let ri = 0;

  while (li < vulnerableCode.length && ri < fixedCode.length) {
    if (vulnerableCode[li] === fixedCode[ri]) {
      lines.push({ type: 'context', leftNum: li + 1, rightNum: ri + 1, content: vulnerableCode[li] });
      li++;
      ri++;
    } else {
      if (vulnerableCode[li] !== fixedCode[ri + 1]) {
        lines.push({ type: 'removed', leftNum: li + 1, rightNum: null, content: vulnerableCode[li] });
        li++;
      }
      if (fixedCode[ri] !== vulnerableCode[li]) {
        lines.push({ type: 'added', leftNum: null, rightNum: ri + 1, content: fixedCode[ri] });
        ri++;
      }
    }
  }
  while (li < vulnerableCode.length) {
    lines.push({ type: 'removed', leftNum: li + 1, rightNum: null, content: vulnerableCode[li] });
    li++;
  }
  while (ri < fixedCode.length) {
    lines.push({ type: 'added', leftNum: null, rightNum: ri + 1, content: fixedCode[ri] });
    ri++;
  }
  return lines;
}

function tokenize(line: string) {
  const tokens: { text: string; className: string }[] = [];
  const regex = /("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(\b(?:import|from|const|let|var|function|return|export|async|await|if|else|new|try|catch|throw)\b)|(\b(?:true|false|null|undefined)\b)|(\/\/.*)|(\{|\}|\(|\)|\[|\])|(\.\w+)|(\b\w+\b)|(\s+)|(.)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match[1]) tokens.push({ text: match[1], className: 'text-amber-300/90' });
    else if (match[2]) tokens.push({ text: match[2], className: 'text-amber-300/90' });
    else if (match[3]) tokens.push({ text: match[3], className: 'text-violet-300' });
    else if (match[4]) tokens.push({ text: match[4], className: 'text-cyan-300' });
    else if (match[5]) tokens.push({ text: match[5], className: 'text-white/20' });
    else if (match[6]) tokens.push({ text: match[6], className: 'text-white/40' });
    else if (match[7]) tokens.push({ text: match[7], className: 'text-cyan-300/70' });
    else if (match[8]) tokens.push({ text: match[8], className: 'text-white/70' });
    else if (match[9]) tokens.push({ text: match[9], className: '' });
    else if (match[10]) tokens.push({ text: match[10], className: 'text-white/50' });
  }
  return tokens;
}

function renderTokens(line: string) {
  return tokenize(line).map((t, i) => (
    <span key={i} className={t.className}>{t.text}</span>
  ));
}

export function GitDiffCodeFix() {
  const [view, setView] = useState<ViewMode>('split');
  const [copied, setCopied] = useState(false);
  const diff = buildDiff();

  const fixedSource = fixedCode.join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fixedSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const copyBtn = (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-200 ${
        copied
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy Secured Code'}
    </button>
  );

  return (
    <div className="rounded-2xl bg-[#0D1224]/80 backdrop-blur-sm border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#030712] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            <FileCode size={13} className="text-cyan-400" />
          </div>
          <span className="text-[12px] font-mono text-white/60 truncate">app/api/chat/route.ts</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#030712] border border-white/[0.06]">
            <button
              onClick={() => setView('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                view === 'split' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              <Columns2 size={12} />
              Split
            </button>
            <button
              onClick={() => setView('unified')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                view === 'unified' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              <SplitSquareHorizontal size={12} />
              Unified
            </button>
          </div>

          {copyBtn}
        </div>
      </div>

      {/* Diff content */}
      <AnimatePresence mode="wait">
        {view === 'split' ? (
          <motion.div
            key="split"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 divide-x divide-white/[0.06]"
          >
            {/* Left: Vulnerable */}
            <div className="bg-[#030712]">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-rose-950/20">
                <AlertTriangle size={11} className="text-rose-400/60" />
                <span className="text-[10px] font-semibold text-rose-400/60 uppercase tracking-wider">Current</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {vulnerableCode.map((line, i) => {
                      const isDiff = diff.find(
                        (d) => d.leftNum === i + 1 && d.type === 'removed'
                      );
                      return (
                        <tr key={i} className={isDiff ? 'bg-rose-950/40' : ''}>
                          <td className={`w-10 min-w-[2.5rem] text-right pr-3 select-none text-[11px] leading-relaxed py-0 align-top ${
                            isDiff ? 'text-rose-400/60' : 'text-white/15'
                          }`}>
                            {isDiff && <span className="mr-1 text-rose-400/60">-</span>}
                            {i + 1}
                          </td>
                          <td className={`text-[13px] leading-relaxed py-0 whitespace-pre ${isDiff ? 'text-rose-200' : 'text-white/60'}`}>
                            {renderTokens(line)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Fixed */}
            <div className="bg-[#030712]">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-emerald-950/20">
                <Shield size={11} className="text-emerald-400/60" />
                <span className="text-[10px] font-semibold text-emerald-400/60 uppercase tracking-wider">Secured</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {fixedCode.map((line, i) => {
                      const isDiff = diff.find(
                        (d) => d.rightNum === i + 1 && d.type === 'added'
                      );
                      return (
                        <tr key={i} className={isDiff ? 'bg-emerald-950/40' : ''}>
                          <td className={`w-10 min-w-[2.5rem] text-right pr-3 select-none text-[11px] leading-relaxed py-0 align-top ${
                            isDiff ? 'text-emerald-400/60' : 'text-white/15'
                          }`}>
                            {isDiff && <span className="mr-1 text-emerald-400/60">+</span>}
                            {i + 1}
                          </td>
                          <td className={`text-[13px] leading-relaxed py-0 whitespace-pre ${isDiff ? 'text-emerald-200' : 'text-white/60'}`}>
                            {renderTokens(line)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="unified"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-[#030712]"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {diff.map((line, i) => {
                    const bgClass = line.type === 'removed' ? 'bg-rose-950/40' : line.type === 'added' ? 'bg-emerald-950/40' : '';
                    const textClass = line.type === 'removed' ? 'text-rose-200' : line.type === 'added' ? 'text-emerald-200' : 'text-white/60';
                    const gutterClass = line.type === 'removed' ? 'text-rose-400/60' : line.type === 'added' ? 'text-emerald-400/60' : 'text-white/15';
                    const prefix = line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' ';
                    return (
                      <tr key={i} className={bgClass}>
                        <td className={`w-10 min-w-[2.5rem] text-right pr-2 select-none text-[11px] leading-relaxed py-0 align-top ${gutterClass}`}>
                          {line.leftNum ?? ''}
                        </td>
                        <td className={`w-10 min-w-[2.5rem] text-right pr-2 select-none text-[11px] leading-relaxed py-0 align-top ${gutterClass}`}>
                          {line.rightNum ?? ''}
                        </td>
                        <td className={`w-5 min-w-[1.25rem] select-none text-[11px] leading-relaxed py-0 align-top ${gutterClass}`}>
                          {prefix}
                        </td>
                        <td className={`text-[13px] leading-relaxed py-0 whitespace-pre ${textClass}`}>
                          {renderTokens(line.content)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer summary */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.06] bg-[#030712]/50">
        <div className="flex items-center gap-1.5 text-[10px] text-rose-400/60">
          <div className="w-2 h-2 rounded-sm bg-rose-500/40" />
          <span>{diff.filter(d => d.type === 'removed').length} deletions</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/60">
          <div className="w-2 h-2 rounded-sm bg-emerald-500/40" />
          <span>{diff.filter(d => d.type === 'added').length} additions</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/20">
          <ArrowRight size={10} />
          <span>Upstash rate limiting applied</span>
        </div>
      </div>
    </div>
  );
}
