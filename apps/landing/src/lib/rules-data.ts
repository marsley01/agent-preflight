import { ALL_CHECKS, CHECKS_BY_CATEGORY } from '@shared/checks/index';
import { CATEGORIES } from '@shared/types';
import type { CheckDefinition, CategoryId } from '@shared/types';

export type RuleItem = CheckDefinition;

export const RULES_CATALOG: RuleItem[] = ALL_CHECKS;
export const RULES_BY_CATEGORY: Record<string, RuleItem[]> = CHECKS_BY_CATEGORY;
export const RULE_CATEGORIES = CATEGORIES;

export type RuleCategory = CategoryId;

export function getRuleById(id: string): RuleItem | undefined {
  return RULES_CATALOG.find((r) => r.id === id);
}