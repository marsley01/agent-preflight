import { useScanStore } from '../../store/scan-store';
import { getCheckById } from '@shared/checks/index';
import {
  X,
  AlertTriangle,
  Shield,
  ShieldAlert,
  FileCode,
  Copy,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Package,
  Github,
  Globe,
  Terminal,
} from 'lucide-react';
import { useState, useCallback } from 'react';

const riskConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'var(--accent-rose)', bg: 'var(--accent-rose-bg)' },
  high: { label: 'High', color: 'var(--accent-rose)', bg: 'var(--accent-rose-bg)' },
  medium: { label: 'Medium', color: 'var(--accent-amber)', bg: 'var(--accent-amber-bg)' },
  low: { label: 'Low', color: 'var(--accent-blue)', bg: 'var(--accent-blue-bg)' },
  info: { label: 'Info', color: 'var(--text-tertiary)', bg: 'transparent' },
};

const THREAT_SOURCE_ICONS: Record<string, typeof Shield> = {
  nvd: Globe,
  github_advisory: Github,
  pypi: Package,
  npm: Package,
};

export function RightPanel() {
  const { inspector, closeInspector, selectedThreat, setSelectedThreat } = useScanStore();
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

  const handleClose = () => {
    setSelectedThreat(null);
    closeInspector();
  };

  // Default placeholder state
  if (!check && !definition && !selectedThreat) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Shield size={14} style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Inspector</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-10 h-10 flex items-center justify-center mb-4" style={{ background: 'var(--bg-hover)', borderRadius: '6px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Select an advisory or scan finding to inspect remediation steps
          </p>
        </div>
      </div>
    );
  }

  // Threat detail view (from LiveFeed)
  if (selectedThreat) {
    const threat = selectedThreat;
    const severityColor = riskConfig[threat.severity]?.color || 'var(--text-tertiary)';
    const severityBg = riskConfig[threat.severity]?.bg || 'transparent';
    const SourceIcon = THREAT_SOURCE_ICONS[threat.source] || Shield;

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} style={{ color: severityColor }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Advisory Detail</span>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1" style={{ borderRadius: '4px' }}>
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Title + severity */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5"
                  style={{ background: severityBg, color: severityColor, borderRadius: '4px' }}
                >
                  {threat.severity.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {threat.vulnerability_type}
                </span>
              </div>
              <h2 className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                {threat.cve_id}
              </h2>
            </div>

            {/* Package info */}
            <Section label="Affected Package">
              <div className="flex items-center gap-2">
                <SourceIcon size={13} style={{ color: 'var(--text-tertiary)' }} />
                <code className="text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {threat.package}
                </code>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {threat.source}
                </span>
              </div>
            </Section>

            {/* Description */}
            <Section label="Description">
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {threat.description}
              </p>
            </Section>

            {/* Remediation code snippet */}
            <Section label="Remediation" icon={<Terminal size={12} style={{ color: 'var(--accent-emerald)' }} />}>
              <div
                className="overflow-hidden"
                style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              >
                <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Fix</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(threat.fix_snippet);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="btn-ghost p-1"
                    style={{ borderRadius: '4px' }}
                  >
                    <Copy size={11} />
                  </button>
                </div>
                <pre className="p-3 text-[12px] font-mono overflow-x-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <code>{threat.fix_snippet}</code>
                </pre>
              </div>
            </Section>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(threat.fix_snippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium transition-colors"
                style={{
                  background: 'var(--accent-emerald-bg)',
                  color: 'var(--accent-emerald)',
                  border: '1px solid var(--accent-emerald-border)',
                  borderRadius: '6px',
                }}
              >
                <Copy size={13} />
                {copied ? 'Copied!' : 'Copy Fix'}
                <ArrowRight size={13} className="ml-auto" />
              </button>
            </div>

            {/* Published date */}
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Published: {threat.published}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scan check inspector view
  if (!check || !definition) return null;

  const risk = riskConfig[definition.risk] || riskConfig.info;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Inspector</span>
        </div>
        <button onClick={handleClose} className="btn-ghost p-1" style={{ borderRadius: '4px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-semibold px-2 py-0.5"
                style={{ background: risk.bg, color: risk.color, borderRadius: '4px' }}
              >
                {risk.label}
              </span>
            </div>
            <h2 className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {definition.title}
            </h2>
          </div>

          {/* Problem */}
          <Section label="Problem">
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{definition.description}</p>
          </Section>

          {/* Why it matters */}
          <Section label="Why this matters" icon={<AlertTriangle size={12} style={{ color: 'var(--accent-amber)' }} />}>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{definition.whyItMatters}</p>
          </Section>

          {/* Example exploit */}
          {definition.exampleExploit && (
            <Section label="Example exploit" icon={<AlertTriangle size={12} style={{ color: 'var(--accent-rose)' }} />}>
              <div
                className="text-[13px] leading-relaxed p-3"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                }}
              >
                {definition.exampleExploit}
              </div>
            </Section>
          )}

          {/* Affected files */}
          {check.file && (
            <Section label="Affected files" icon={<FileCode size={12} style={{ color: 'var(--accent-blue)' }} />}>
              <div
                className="flex items-center gap-2 text-[12px] font-mono px-3 py-2"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                }}
              >
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                <span>{check.file}</span>
                {check.line && <span style={{ color: 'var(--text-muted)' }}>:{check.line}</span>}
              </div>
            </Section>
          )}

          {/* Suggested fix */}
          <Section label="Suggested fix" icon={<Sparkles size={12} style={{ color: 'var(--accent-violet)' }} />}>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
              {check.suggestedFix || definition.suggestedFix}
            </p>

            {check.snippet && (
              <div
                className="overflow-hidden"
                style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
              >
                <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Current code</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(check.snippet || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="btn-ghost p-1"
                    style={{ borderRadius: '4px' }}
                  >
                    <Copy size={11} />
                  </button>
                </div>
                <pre className="p-3 text-[12px] font-mono overflow-x-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium transition-colors"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                }}
              >
                <Copy size={13} />
                {copied ? 'Copied!' : 'Copy Patch'}
                <ArrowRight size={13} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
              </button>
            )}

            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium text-white transition-colors"
              style={{ background: 'var(--accent-blue)', borderRadius: '6px' }}
            >
              <Sparkles size={13} />
              Generate AI Fix
              <ArrowRight size={13} className="ml-auto" />
            </button>

            {definition.documentationUrl && (
              <a
                href={definition.documentationUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium transition-colors"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                }}
              >
                <ExternalLink size={13} />
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
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}
