/** Canadian composition. Registry-free; see ../uk/options.ts for why. */
import type { EngineOptions } from '../common/engine.ts';
import type { CalculationInput, ResultNotice } from '../common/types.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

export const CA_LAUNCH_PROVINCES = ['ontario', 'british-columbia', 'alberta', 'quebec'] as const;
export type CaProvince = (typeof CA_LAUNCH_PROVINCES)[number];

export function buildCanadaOptions(
  provincialRuleset: Ruleset,
  federalRuleset: Ruleset,
  input: CalculationInput,
  province: string,
): EngineOptions {
  const notices: ResultNotice[] = [];

  if (provincialRuleset.rules.optionalSchemes['usesQpp'] === true) {
    notices.push({
      severity: 'info',
      message:
        'Quebec collects its own provincial income tax through Revenu Québec, replaces CPP with QPP, adds QPIP premiums, and reduces federal tax by the Quebec abatement. Each is sourced separately and shown as its own line.',
    });
  }

  return {
    ruleset: provincialRuleset,
    composedRulesets: [federalRuleset],
    input: { ...input, subJurisdiction: province },
    extraNotices: notices,
  };
}
