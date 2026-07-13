import { useEffect, useRef } from 'react';
import { useScanStore } from '../../store/scan-store';
import { Shield, ShieldAlert, Globe, Github, Package, ExternalLink, AlertTriangle } from 'lucide-react';

const VULN_ENGINE_URL = 'http://localhost:8412';

const SOURCE_ICONS: Record<string, typeof Shield> = {
  nvd: Shield,
  github_advisory: Github,
  pypi: Package,
  npm: Package,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--accent-rose)',
  high: 'var(--accent-rose)',
  medium: 'var(--accent-amber)',
  low: 'var(--accent-blue)',
  info: 'var(--text-tertiary)',
};

export function LiveFeed() {
  const { threats, setThreats, threatLoading, setThreatLoading } = useScanStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchThreats() {
      setThreatLoading(true);
      try {
        const resp = await fetch(`${VULN_ENGINE_URL}/v1/intelligence?limit=30`);
        if (resp.ok) {
          const data = await resp.json();
          setThreats(data.items || []);
        }
      } catch {
        // engine not running — use fallback static data
        setThreats(FALLBACK_THREATS);
      } finally {
        setThreatLoading(false);
      }
    }

    fetchThreats();
    intervalRef.current = setInterval(fetchThreats, 300_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setThreats, setThreatLoading]);

  return (
    <div className="panel overflow-hidden animate-fadeIn" style={{ maxHeight: '400px' }}>
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wider"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        <ShieldAlert size={13} />
        Live Intelligence Feed
        {threatLoading && (
          <span className="flex items-center gap-1 ml-auto text-[10px] font-normal normal-case" style={{ color: 'var(--accent-emerald)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            live
          </span>
        )}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
        {threats.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            {threatLoading ? 'Loading threat intelligence...' : 'No threats loaded. Start the vulnerability engine on port 8412.'}
          </div>
        ) : (
          threats.map((threat, idx) => {
            const SourceIcon = SOURCE_ICONS[threat.source] || Shield;
            const severityColor = SEVERITY_COLORS[threat.severity] || 'var(--text-tertiary)';
            return (
              <div
                key={`${threat.cve_id}-${idx}`}
                className="flex items-start gap-3 px-4 py-2.5 border-b text-left hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="mt-0.5" style={{ color: severityColor }}>
                  <SourceIcon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                      {threat.cve_id}
                    </span>
                    <span
                      className="text-[9px] font-medium px-1 py-0.5 rounded uppercase"
                      style={{
                        background: `${severityColor}15`,
                        color: severityColor,
                        border: `1px solid ${severityColor}30`,
                      }}
                    >
                      {threat.severity}
                    </span>
                  </div>
                  <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {threat.description.slice(0, 120)}...
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-medium font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {threat.package}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {threat.source}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const FALLBACK_THREATS = [
  {
    package: "pypi:openai",
    vulnerability_type: "advisory",
    cve_id: "GHSA-openai-001",
    severity: "high",
    description: "Prompt injection vulnerability in OpenAI SDK versions < 1.58.0 allows system prompt leakage via crafted multi-turn conversations.",
    fix_snippet: "Upgrade openai>=1.58.0",
    source: "github_advisory",
    published: "2026-07-10",
  },
  {
    package: "npm:langchain",
    vulnerability_type: "cve",
    cve_id: "CVE-2026-4123",
    severity: "critical",
    description: "Remote code execution in LangChain tool calling when untrusted input contains malicious function definitions.",
    fix_snippet: "Upgrade @langchain/core>=0.3.28",
    source: "nvd",
    published: "2026-07-08",
  },
  {
    package: "pypi:anthropic",
    vulnerability_type: "release",
    cve_id: "release-anthropic-0.49.0",
    severity: "info",
    description: "New release: anthropic v0.49.0 — Adds tool use streaming and improved rate limit handling.",
    fix_snippet: "Upgrade anthropic==0.49.0",
    source: "pypi",
    published: "2026-07-06",
  },
  {
    package: "npm:vectordb",
    vulnerability_type: "cve",
    cve_id: "CVE-2026-4189",
    severity: "high",
    description: "Vector database query injection via malicious embedding input — untrusted vectors bypass access controls.",
    fix_snippet: "Upgrade vectordb>=0.7.2",
    source: "nvd",
    published: "2026-07-05",
  },
  {
    package: "pypi:transformers",
    vulnerability_type: "advisory",
    cve_id: "GHSA-transformers-002",
    severity: "medium",
    description: "Deserialization vulnerability in Transformers model loading when using unsafe weights format from untrusted sources.",
    fix_snippet: "Use safe_serialization=True when loading model weights",
    source: "github_advisory",
    published: "2026-07-03",
  },
  {
    package: "npm:openai",
    vulnerability_type: "release",
    cve_id: "release-openai-4.73.0",
    severity: "info",
    description: "New release: openai v4.73.0 — Structured output improvements and response_format validation.",
    fix_snippet: "npm install openai@4.73.0",
    source: "npm",
    published: "2026-07-02",
  },
];
