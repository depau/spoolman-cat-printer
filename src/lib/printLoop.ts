import type { CatPrinter } from '@opuu/cat-printer';
import type { RenderedLabel } from '@/lib/labelRenderer';
import type { AlignmentParams } from '@/lib/paperAlignment';
import { debugLog, debugError } from '@/store/debugStore';

export interface PrintLoopCallbacks {
  onProgress: (current: number, total: number) => void;
  onPaused: (resumeIndex: number) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  shouldPause: () => boolean;
  shouldCancel: () => boolean;
}

/** Feed and sync — waits for printer to acknowledge (it won't respond until done) */
async function syncFeed(printer: CatPrinter, lines: number): Promise<void> {
  if (lines <= 0) return;
  debugLog(`Feed ${lines} lines`);
  await printer.feed(lines);
  await printer.getDeviceState();
}

/** Retract and sync */
async function syncRetract(printer: CatPrinter, lines: number): Promise<void> {
  if (lines <= 0) return;
  debugLog(`Retract ${lines} lines`);
  await printer.retract(lines);
  await printer.getDeviceState();
}

/** Print bitmap and sync.
 *
 * Unlike printer.printBitmap(), this implementation sends feed(1) for blank
 * (all-zero) rows instead of silently skipping them.  Skipping blank rows
 * causes the paper NOT to advance for those lines, so labels with no border
 * (where top/bottom margin rows are pure white) end up shorter than expected,
 * breaking alignment.
 */
async function syncPrintBitmap(
  printer: CatPrinter,
  label: RenderedLabel
): Promise<void> {
  const pitch = Math.ceil(label.width / 8);
  let pendingFeeds = 0;

  for (let row = 0; row < label.height; row++) {
    const offset = row * pitch;
    const line = label.bitmap.slice(offset, offset + pitch);
    const isBlank = line.every((b) => b === 0);

    if (isBlank) {
      pendingFeeds++;
    } else {
      // Flush accumulated blank rows as a single feed command.
      if (pendingFeeds > 0) {
        await printer.feed(pendingFeeds);
        pendingFeeds = 0;
      }
      await printer.draw(line);
    }
  }

  // Trailing blank rows: feed so paper advances to the correct position.
  if (pendingFeeds > 0) {
    await printer.feed(pendingFeeds);
  }

  await printer.getDeviceState();
}

export async function runPrintLoop(
  printer: CatPrinter,
  labels: RenderedLabel[],
  alignment: AlignmentParams,
  speed: number,
  energy: number,
  callbacks: PrintLoopCallbacks,
  startIndex = 0
): Promise<void> {
  const { onProgress, onPaused, onDone, onError, shouldPause, shouldCancel } = callbacks;

  try {
    debugLog(`Print loop started: ${labels.length} labels, speed=${speed}, energy=${energy}, startIndex=${startIndex}`);
    await printer.prepare(speed, energy);

    if (alignment.startRetract > 0) {
      await syncRetract(printer, alignment.startRetract);
    }

    for (let i = startIndex; i < labels.length; i++) {
      debugLog(`Printing label ${i + 1}/${labels.length}`);
      onProgress(i + 1, labels.length);

      await syncPrintBitmap(printer, labels[i]);

      if (shouldCancel()) {
        debugLog('Print cancelled — advancing to cut position');
        await syncFeed(printer, alignment.endFeed);
        onDone();
        return;
      }

      if (shouldPause()) {
        debugLog(`Print paused after label ${i + 1} — advancing to cut position`);
        await syncFeed(printer, alignment.endFeed);
        onPaused(i + 1);
        return;
      }

      if (i < labels.length - 1) {
        await syncFeed(printer, alignment.interFeed);
      }
    }

    debugLog('All labels printed — advancing to cut position');
    await syncFeed(printer, alignment.endFeed);
    onDone();
  } catch (err) {
    debugError(`Print loop error: ${err}`);
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
