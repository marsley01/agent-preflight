import { create } from 'zustand';
import { RULES_CATALOG, RULE_CATEGORIES, type RuleItem, type RuleCategory } from '../lib/rules-data';

interface RulesState {
  rules: RuleItem[];
  activeCategory: string;
  searchQuery: string;
  setActiveCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useRulesStore = create<RulesState>((set) => ({
  rules: RULES_CATALOG,
  activeCategory: 'all',
  searchQuery: '',
  setActiveCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

export { RULE_CATEGORIES };
export type { RuleCategory };
