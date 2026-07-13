import { useEffect, useRef } from 'react';
import { useScanStore } from '../../store/scan-store';
import { Terminal } from 'lucide-react';

export function ScanTerminal() {
  const { terminalLogs, isScanning } = useScanStore();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs.length]);

  if (!isScanning && terminalLogs.length === 0) return null;

  return (
    <div
      className="panel overflow-hidden animate-fadeIn"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '1.6',
      }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b text-[11px] font-medium"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-tertiary)',
          background: 'var(--bg-base)',
        }}
      >
        <Terminal size={13} />
        <span className="uppercase tracking-wider">Scan Log</span>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {terminalLogs.length} lines
        </span>
      </div>

      {/* Terminal body */}
      <div
        className="p-3 overflow-y-auto"
        style={{
          maxHeight: '200px',
          background: 'var(--bg-base)',
          color: 'var(--accent-emerald)',
        }}
      >
        {terminalLogs.length === 0 ? (
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            $ preflight scan --engine=vuln --verbose
          </div>
        ) : (
          terminalLogs.map((line, i) => {
            const isTimestamp = /^\[\d{2}:\d{2}:\d{2}\]/.test(line);
            return (
              <div
                key={i}
                className="whitespace-pre-wrap"
                style={{
                  color: line.includes('ERROR')
                    ? 'var(--accent-rose)'
                    : line.includes('WARN')
                      ? 'var(--accent-amber)'
                      : line.includes('PASS')
                        ? 'var(--accent-emerald)'
                        : line.includes('FAIL')
                          ? 'var(--accent-rose)'
                          : line.includes('INFO') || isTimestamp
                            ? 'var(--text-secondary)'
                            : 'var(--accent-emerald)',
                }}
              >
                <span className="select-none" style={{ color: 'var(--text-muted)' }}>
                  {String(i + 1).padStart(3, ' ')} {'  '}
                </span>
                {line}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
