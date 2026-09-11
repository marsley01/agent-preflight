import { create } from 'zustand';
import { RULES_CATALOG, RULE_CATEGORIES, RuleItem, RuleCategory } from '../lib/rules-data';
import type { RiskLevel } from '@shared/types';

export type RuleLevel = 'error' | 'warn' | 'off';

export interface PreflightConfig {
  $schema: string;
  engine: string;
  rules: Record<string, RuleLevel>;
  ignore: string[];
}

interface RulesState {
  rules: RuleItem[];
  ruleLevels: Record<string, RuleLevel>;
  activeCategory: string;
  searchQuery: string;
  config: PreflightConfig;

  // Actions
  setRuleLevel: (ruleId: string, level: RuleLevel) => void;
  setActiveCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  getConfigJSON: () => string;
  exportCatalogJSON: () => void;
}

export function riskToLevel(risk: RiskLevel): RuleLevel {
  if (risk === 'critical' || risk === 'high') return 'error';
  if (risk === 'medium') return 'warn';
  return 'off';
}

function buildDefaults(): Record<string, RuleLevel> {
  const defaults: Record<string, RuleLevel> = {};
  for (const rule of RULES_CATALOG) {
    defaults[rule.id] = riskToLevel(rule.risk);
  }
  return defaults;
}

const DEFAULT_LEVELS: Record<string, RuleLevel> = buildDefaults();

export const useRulesStore = create<RulesState>((set, get) => ({
  rules: RULES_CATALOG,
  ruleLevels: DEFAULT_LEVELS,
  activeCategory: 'all',
  searchQuery: '',
  config: {
    $schema: "https://preflight.dev/schema/v1.json",
    engine: "v1.4.2",
    rules: DEFAULT_LEVELS,
    ignore: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**"
    ]
  },

  setRuleLevel: (ruleId, level) => {
    set((state) => {
      const newLevels = { ...state.ruleLevels, [ruleId]: level };
      return {
        ruleLevels: newLevels,
        config: {
          ...state.config,
          rules: newLevels
        }
      };
    });
  },

  setActiveCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getConfigJSON: () => {
    const { config } = get();
    return JSON.stringify(config, null, 2);
  },

  exportCatalogJSON: () => {
    const jsonStr = get().getConfigJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preflight-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}));

export { RULE_CATEGORIES };
export type { RuleCategory };