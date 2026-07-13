import { useScanStore } from '../../store/scan-store';
import { SCAN_STAGE_LABELS, SCAN_STAGES } from '@shared/types';
import { motion } from 'framer-motion';

export function ScanProgress() {
  const progress = useScanStore((s) => s.progress);
  const stage = progress?.stage;
  const stageIndex = progress?.stageIndex ?? 0;
  const totalStages = SCAN_STAGES.length;
  const pct = Math.min(Math.round(((stageIndex + 1) / totalStages) * 100), 100);

  return (
    <div className="panel p-5 space-y-4 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="relative w-5 h-5">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-base-100">
            Scanning repository
          </div>
          <div className="text-[12px] text-base-500">
            {stage ? SCAN_STAGE_LABELS[stage] : 'Initializing...'}
            <span className="mx-1">·</span>
            Step {Math.min(stageIndex + 1, totalStages)} of {totalStages}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
        <motion.div
          className="h-full" style={{ background: 'var(--accent-blue)', borderRadius: '4px' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Stage list */}
      <div className="space-y-1">
        {SCAN_STAGES.map((s, i) => {
          const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending';
          return (
            <div
              key={s}
              className={`flex items-center gap-2.5 py-1 transition-colors ${
                state === 'active'
                  ? 'text-blue-400'
                  : state === 'done'
                    ? 'text-emerald-400'
                    : 'text-base-600'
              }`}
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                {state === 'active' && (
                  <motion.div
                    className="w-2 h-2" style={{ background: 'var(--accent-blue)', borderRadius: '4px' }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                {state === 'done' && (
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8.5l3 3 5-6" />
                  </svg>
                )}
                {state === 'pending' && (
                  <div className="w-1.5 h-1.5" style={{ background: 'var(--border-subtle)', borderRadius: '4px' }} />
                )}
              </div>
              <span className="text-[12px]">{SCAN_STAGE_LABELS[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
