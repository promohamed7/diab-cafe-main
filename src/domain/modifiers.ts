// Modifier selection rules for the customer UI.
//
// This is UX guidance only. Café must enforce the same rules on its side
// (required groups, single-select, duplicates, option ↔ product linkage).

import type { CafeId, CatalogModifierGroup, CatalogProduct } from '../types/catalog.ts';

export type ModifierIssueKind = 'REQUIRED_MISSING' | 'TOO_MANY_IN_SINGLE_GROUP' | 'UNKNOWN_OPTION' | 'DUPLICATE_OPTION';

export interface ModifierIssue {
  kind: ModifierIssueKind;
  groupId: CafeId | null;
  optionId: CafeId | null;
}

/** Upper bound on options in one line, as a sanity limit (Café has none yet). */
export const MAX_OPTIONS_PER_LINE = 20;

export function normalizeOptionIds(optionIds: readonly CafeId[]): CafeId[] {
  return [...new Set(optionIds)].sort((a, b) => a - b);
}

export function validateModifierSelection(product: CatalogProduct, optionIds: readonly CafeId[]): ModifierIssue[] {
  const issues: ModifierIssue[] = [];
  const seen = new Set<CafeId>();
  const groupOf = new Map<CafeId, CatalogModifierGroup>();
  for (const g of product.modifierGroups) for (const o of g.options) groupOf.set(o.id, g);

  for (const optionId of optionIds) {
    if (seen.has(optionId)) issues.push({ kind: 'DUPLICATE_OPTION', groupId: null, optionId });
    seen.add(optionId);
    if (!groupOf.has(optionId)) issues.push({ kind: 'UNKNOWN_OPTION', groupId: null, optionId });
  }

  for (const group of product.modifierGroups) {
    const picked = group.options.filter((o) => seen.has(o.id)).length;
    if (group.isRequired && group.options.length > 0 && picked === 0) {
      issues.push({ kind: 'REQUIRED_MISSING', groupId: group.id, optionId: null });
    }
    if (!group.allowMultiple && picked > 1) {
      issues.push({ kind: 'TOO_MANY_IN_SINGLE_GROUP', groupId: group.id, optionId: null });
    }
  }

  if (seen.size > MAX_OPTIONS_PER_LINE) {
    issues.push({ kind: 'TOO_MANY_IN_SINGLE_GROUP', groupId: null, optionId: null });
  }
  return issues;
}

/**
 * Toggle an option respecting the group rule: single-select groups replace the
 * current choice (and a non-required single choice can be cleared again);
 * multi-select groups add/remove.
 */
export function toggleModifierOption(
  product: CatalogProduct,
  current: readonly CafeId[],
  optionId: CafeId
): CafeId[] {
  const group = product.modifierGroups.find((g) => g.options.some((o) => o.id === optionId));
  if (!group) return [...current];

  const selected = current.includes(optionId);
  if (group.allowMultiple) {
    return normalizeOptionIds(selected ? current.filter((id) => id !== optionId) : [...current, optionId]);
  }

  const groupOptionIds = new Set(group.options.map((o) => o.id));
  const withoutGroup = current.filter((id) => !groupOptionIds.has(id));
  if (selected) return normalizeOptionIds(group.isRequired ? current : withoutGroup);
  return normalizeOptionIds([...withoutGroup, optionId]);
}
