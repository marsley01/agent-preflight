import { useScanStore } from '../../store/scan-store';
import { getCheckById } from '@shared/checks/index';
import {
  X,
  AlertTriangle,
  Shield,
  FileCode,
  Copy,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { useState, useCallback } from 'react';

const riskConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  low: { label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  info: { label: 'Info', color: 'text-base-400', bg: 'bg-base-800 border-base-700' },
};

export function RightPanel() {
  const { inspector, closeInspector } = useScanStore();
  const { check, definition } = inspector;
  const [copied, setCopied] = useState(false);

  const handleCopyPatch = useCallback(async () => {
    if (!check?.patch) return;
    try {
      await navigator.clipboard.writeText(check.patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [check]);

  if (!check || !definition) {
    return (
      <div className="p-4 text-[13px] text-base-500">
        Select a check to inspect
      </div>
    );
  }

  const risk = riskConfig[definition.risk] || riskConfig.info;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-800">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-base-400" />
          <span className="text-[12px] font-semibold text-base-300 uppercase tracking-wider">Inspector</span>
        </div>
        <button onClick={closeInspector} className="btn-ghost p-1">
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${risk.bg} ${risk.color}`}>
                {risk.label}
              </span>
            </div>
            <h2 className="text-[15px] font-semibold text-base-100 leading-snug">
              {definition.title}
            </h2>
          </div>

          {/* Problem */}
          <Section label="Problem">
            <p className="text-[13px] text-base-400 leading-relaxed">{definition.description}</p>
          </Section>

          {/* Why it matters */}
          <Section label="Why this matters" icon={<AlertTriangle size={12} className="text-amber-400" />}>
            <p className="text-[13px] text-base-400 leading-relaxed">{definition.whyItMatters}</p>
          </Section>

          {/* Example exploit */}
          {definition.exampleExploit && (
            <Section label="Example exploit" icon={<AlertTriangle size={12} className="text-red-400" />}>
              <div className="text-[13px] text-base-400 leading-relaxed panel !bg-base-950 p-3 rounded-md border-base-800">
                {definition.exampleExploit}
              </div>
            </Section>
          )}

          {/* Affected files */}
          {check.file && (
            <Section label="Affected files" icon={<FileCode size={12} className="text-blue-400" />}>
              <div className="flex items-center gap-2 text-[13px] font-mono text-base-300 panel !bg-base-950 px-3 py-2 rounded-md">
                <ChevronRight size={12} className="text-base-600" />
                <span>{check.file}</span>
                {check.line && <span className="text-base-600">:{check.line}</span>}
              </div>
            </Section>
          )}

          {/* Suggested fix */}
          <Section label="Suggested fix" icon={<Sparkles size={12} className="text-violet-400" />}>
            <p className="text-[13px] text-base-400 leading-relaxed mb-3">
              {check.suggestedFix || definition.suggestedFix}
            </p>

            {/* Example code */}
            {check.snippet && (
              <div className="panel !bg-base-950 rounded-md overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-base-800">
                  <span className="text-[10px] text-base-600 font-medium">Current code</span>
                  <button onClick={() => {
                    navigator.clipboard.writeText(check.snippet || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }} className="btn-ghost p-1 text-base-600">
                    <Copy size={11} />
                  </button>
                </div>
                <pre className="p-3 text-[12px] font-mono text-base-300 overflow-x-auto leading-relaxed">
                  <code>{check.snippet}</code>
                </pre>
              </div>
            )}
          </Section>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {check.snippet && (
              <button
                onClick={handleCopyPatch}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-md bg-base-800 hover:bg-base-700 transition-colors text-[13px] font-medium text-base-200"
              >
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy Patch'}
                <ArrowRight size={14} className="ml-auto text-base-500" />
              </button>
            )}

            <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-md bg-blue-500 hover:bg-blue-400 transition-colors text-[13px] font-medium text-white">
              <Sparkles size={14} />
              Generate AI Fix
              <ArrowRight size={14} className="ml-auto" />
            </button>

            {definition.documentationUrl && (
              <a
                href={definition.documentationUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-md bg-base-800 hover:bg-base-700 transition-colors text-[13px] font-medium text-base-200"
              >
                <ExternalLink size={14} />
                View Documentation
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-500">{label}</span>
      </div>
      {children}
    </div>
  );
}
