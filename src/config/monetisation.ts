/**
 * Display-advertising configuration.
 *
 * No third-party ad script is loaded anywhere in this codebase while
 * `ADS_ENABLED` is false. Slots still render as reserved, labelled, fixed-height
 * boxes so that enabling ads later cannot introduce cumulative layout shift.
 */

export type AdSlotId = 'result-rail' | 'post-result' | 'guide-mid-content';

export interface AdSlotConfig {
  readonly id: AdSlotId;
  readonly label: string;
  /** Reserved box size per breakpoint, in CSS pixels. Prevents layout shift. */
  readonly reserve: { readonly mobile: [number, number]; readonly desktop: [number, number] };
  /** Network slot identifier. Empty until the owner supplies a real one. */
  readonly networkSlotId: string;
  readonly enabled: boolean;
}

function env(key: string, fallback: string): string {
  const value = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Master kill switch. Stays false until the owner has an approved ad-network
 * account AND a certified consent-management platform is configured for
 * UK/EEA traffic. See docs/DECISIONS.md (D-009).
 */
export const ADS_ENABLED = env('ADS_ENABLED', 'false') === 'true';

/** Publisher identifier, e.g. an AdSense `ca-pub-` value. Empty until supplied. */
export const AD_PUBLISHER_ID = env('AD_PUBLISHER_ID', '');

/**
 * ads.txt is only generated when a genuine publisher line is supplied.
 * An invented or partial ads.txt is worse than none at all.
 */
export const ADS_TXT_LINES: readonly string[] = env('ADS_TXT_LINES', '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

export const AD_SLOTS: readonly AdSlotConfig[] = [
  {
    id: 'result-rail',
    label: 'Advertisement',
    reserve: { mobile: [0, 0], desktop: [300, 600] },
    networkSlotId: env('AD_SLOT_RESULT_RAIL', ''),
    enabled: ADS_ENABLED,
  },
  {
    id: 'post-result',
    label: 'Advertisement',
    reserve: { mobile: [320, 250], desktop: [728, 90] },
    networkSlotId: env('AD_SLOT_POST_RESULT', ''),
    enabled: ADS_ENABLED,
  },
  {
    id: 'guide-mid-content',
    label: 'Advertisement',
    reserve: { mobile: [320, 250], desktop: [728, 90] },
    networkSlotId: env('AD_SLOT_GUIDE_MID', ''),
    enabled: ADS_ENABLED,
  },
];

export function getAdSlot(id: AdSlotId): AdSlotConfig {
  const slot = AD_SLOTS.find((candidate) => candidate.id === id);
  if (!slot) throw new Error(`Unknown ad slot: ${id}`);
  return slot;
}

/**
 * Ads are suppressed on pages where a misread placement would be actively
 * harmful or where policy risk is highest.
 */
export const AD_FREE_PAGE_PREFIXES: readonly string[] = [
  '/privacy/',
  '/cookies/',
  '/terms/',
  '/disclaimer/',
  '/corrections/',
  '/editorial-policy/',
  '/sources/',
];
