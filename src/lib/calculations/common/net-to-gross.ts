/**
 * Net-to-gross inversion by bounded bisection.
 *
 * There is no closed-form inverse once tapers, levy floors, and contribution
 * caps are involved, so the gross is searched for rather than derived. The
 * search is bounded, iteration-capped, and its answer is verified by feeding it
 * back through the forward calculation — if the round trip does not land within
 * tolerance the caller is told the input is unsupported rather than handed a
 * confident-looking wrong number.
 */
import { type Money, money, ZERO, roundToMinorUnit, roundToUnit } from './money.ts';

export interface NetToGrossOptions {
  /** Currency units of acceptable error on the resulting net figure. */
  readonly tolerance?: Money;
  readonly maxIterations?: number;
  /** Upper bound of the search. Raised automatically if the target exceeds it. */
  readonly upperBound?: Money;
}

export type NetToGrossOutcome =
  | {
      readonly ok: true;
      readonly gross: Money;
      readonly achievedNet: Money;
      readonly iterations: number;
    }
  | { readonly ok: false; readonly reason: string };

const DEFAULT_TOLERANCE = money('0.01');
const DEFAULT_MAX_ITERATIONS = 200;
const DEFAULT_UPPER_BOUND = money(10_000_000);

/**
 * @param targetNet  the take-home figure the user wants
 * @param netFor     forward calculation: gross annual -> net annual
 */
export function solveGrossForNet(
  targetNet: Money,
  netFor: (gross: Money) => Money,
  options: NetToGrossOptions = {},
): NetToGrossOutcome {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  if (targetNet.lt(0)) return { ok: false, reason: 'Target take-home pay cannot be negative.' };
  if (targetNet.eq(0)) return { ok: true, gross: ZERO, achievedNet: ZERO, iterations: 0 };

  let low = ZERO;
  let high = options.upperBound ?? DEFAULT_UPPER_BOUND;

  // Grow the bound rather than fail, but keep the growth bounded too.
  let expansions = 0;
  while (netFor(high).lt(targetNet)) {
    high = high.times(2);
    expansions += 1;
    if (expansions > 20) {
      return {
        ok: false,
        reason: 'Target take-home pay is outside the supported range for this calculator.',
      };
    }
  }

  let iterations = 0;
  let mid = high;

  while (iterations < maxIterations) {
    iterations += 1;
    mid = low.plus(high).div(2);
    const net = netFor(mid);
    const difference = net.minus(targetNet);

    if (difference.abs().lte(tolerance)) {
      return finalise(mid, targetNet, netFor, tolerance, iterations);
    }

    if (difference.lt(0)) {
      low = mid;
    } else {
      high = mid;
    }

    // The bracket has collapsed without meeting tolerance: a genuine cliff in
    // the rules sits exactly at this net figure and no gross produces it.
    if (high.minus(low).lte(money('0.0001'))) {
      return {
        ok: false,
        reason:
          'No gross salary produces exactly this take-home pay in this tax system, which usually means the figure falls across a threshold.',
      };
    }
  }

  return { ok: false, reason: 'The search for a matching gross salary did not converge.' };
}

/**
 * Present the tidiest gross that still reproduces the target net within
 * tolerance. Bisection lands on values like 60000.01 when 60000 is equally
 * correct, and a net-to-gross calculator that answers "£60,000.01" reads as
 * broken even though it is within a penny. Candidates are tried from tidiest to
 * least tidy, and every one is verified against the forward calculation before
 * it is offered.
 */
function finalise(
  candidateGross: Money,
  targetNet: Money,
  netFor: (gross: Money) => Money,
  tolerance: Money,
  iterations: number,
): NetToGrossOutcome {
  const candidates = [
    roundToUnit(candidateGross),
    roundToMinorUnit(candidateGross),
    candidateGross,
  ];

  for (const candidate of candidates) {
    if (candidate.lt(0)) continue;
    const achievedNet = netFor(candidate);
    if (achievedNet.minus(targetNet).abs().lte(tolerance)) {
      return { ok: true, gross: candidate, achievedNet, iterations };
    }
  }

  // Nothing reproduced the target: report it rather than return the closest miss.
  return {
    ok: false,
    reason: 'The gross figure could not be verified against the forward calculation.',
  };
}
