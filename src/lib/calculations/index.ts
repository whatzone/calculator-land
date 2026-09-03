/**
 * Calculation entry point. Routes an input to the correct jurisdiction adapter.
 */
import type { CalculationInput, CalculationResult, JurisdictionCode } from './common/types.ts';
import { calculateUkSalary } from './uk/index.ts';
import { calculateIrelandSalary } from './ireland/index.ts';
import { calculateAustraliaSalary } from './australia/index.ts';
import { calculateNewZealandSalary } from './new-zealand/index.ts';
import { calculateCanadaSalary } from './canada/index.ts';

const ADAPTERS: Record<JurisdictionCode, (input: CalculationInput) => CalculationResult> = {
  uk: calculateUkSalary,
  ireland: calculateIrelandSalary,
  australia: calculateAustraliaSalary,
  'new-zealand': calculateNewZealandSalary,
  canada: calculateCanadaSalary,
};

export function calculateSalary(input: CalculationInput): CalculationResult {
  const adapter = ADAPTERS[input.jurisdiction];
  if (!adapter) throw new Error(`No calculation adapter for jurisdiction: ${input.jurisdiction}`);
  return adapter(input);
}

export {
  calculateUkSalary,
  calculateIrelandSalary,
  calculateAustraliaSalary,
  calculateNewZealandSalary,
  calculateCanadaSalary,
};
export * from './common/types.ts';
