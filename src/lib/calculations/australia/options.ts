/** Australian profile handling. Registry-free; see ../uk/options.ts for why. */
import type { EngineOptions } from '../common/engine.ts';
import { readBoolean, requireScheme } from '../common/profile.ts';
import type { CalculationInput, ResultNotice } from '../common/types.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

export function buildAustraliaOptions(ruleset: Ruleset, input: CalculationInput): EngineOptions {
  const notices: ResultNotice[] = [];

  if (readBoolean(input, 'hasHelpDebt', false)) {
    const scheme = requireScheme(
      ruleset,
      'studyAndTrainingLoan',
      'A HELP or study and training loan',
    );
    if (!scheme.ok) notices.push(scheme.notice);
  }

  if (!readBoolean(input, 'claimsTaxFreeThreshold', true)) {
    notices.push({
      severity: 'unsupported',
      message:
        'Not claiming the tax-free threshold changes the withholding scale used by your employer. That scale is not modelled, so this result assumes the threshold is claimed.',
    });
  }

  return {
    ruleset,
    input,
    extraNotices: notices,
    extraAssumptions: [
      'The superannuation guarantee is paid by your employer on top of this salary and is therefore not deducted from the take-home figure.',
    ],
  };
}
