import type { LabelProfile, PrinterProfile } from '@/types/profiles';
import { mmToPx } from '@/lib/utils';

export interface AlignmentParams {
  /** Lines to RETRACT before first label (positions print head at label start) */
  startRetract: number;
  /** Lines to FEED between labels (advances through gap to next label start) */
  interFeed: number;
  /**
   * Lines to FEED at the end / on pause / on cancel.
   * Advances paper so the cutting blade lands at the mid-gap position.
   */
  endFeed: number;
  isUnlimited: boolean;
}

/**
 * Compute paper alignment for a print job.
 *
 * Assumes the printer blade is at the mid-gap cutting point when starting.
 *
 * Fixed-height labels:
 *   startRetract  = max(0, B - round(G/2))   — retract so head is G/2 lines past cut edge
 *   interFeed     = G                         — feed through gap to next label start
 *   endFeed       = round(G/2) + B            — feed so blade lands at mid-gap after label
 *
 * Margins are baked into the bitmap and must NOT be added here.
 *
 * Unlimited-height labels (user positions paper manually, blade flush with label top):
 *   startRetract  = 0   (user already positioned)
 *   interFeed     = 0   (labels are back-to-back; margins are inside the bitmap)
 *   endFeed       = B   (feed so blade reaches end of last label for tearing)
 */
export function computeAlignment(
  labelProfile: LabelProfile,
  printerProfile: PrinterProfile
): AlignmentParams {
  const B = printerProfile.bladeOffsetLines;
  const dpi = printerProfile.dpi;

  if (labelProfile.heightMm === null) {
    return {
      startRetract: 0,
      interFeed: 0,
      endFeed: B,
      isUnlimited: true,
    };
  }

  const G = mmToPx(labelProfile.gapMm, dpi);
  const halfG = Math.round(G / 2);

  return {
    startRetract: Math.max(0, B - halfG),
    interFeed: G,
    endFeed: halfG + B,
    isUnlimited: false,
  };
}

