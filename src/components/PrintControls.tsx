import React, { useRef, useState } from 'react';
import { Play, Square, Pause, SkipForward, PlayCircle, Loader2 } from 'lucide-react';
import { usePrinterStore, getPrinterInstance } from '@/store/printerStore';
import { usePrintJobStore } from '@/store/printJobStore';
import { useSettingsStore } from '@/store/settingsStore';
import { renderLabel } from '@/lib/labelRenderer';
import { computeAlignment } from '@/lib/paperAlignment';
import { runPrintLoop } from '@/lib/printLoop';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import type { RenderedLabel } from '@/lib/labelRenderer';

export function PrintControls() {
  const printerStore = usePrinterStore();
  const jobStore = usePrintJobStore();
  const settings = useSettingsStore();
  const toast = useToast();

  const renderedLabels = useRef<RenderedLabel[]>([]);
  const resumeIndex = useRef(0);
  const [skipRetract, setSkipRetract] = useState(false);

  const { status, hardwareState, speed, energy } = printerStore;
  const {
    jobStatus,
    jobProgress,
    setJobStatus,
    setJobProgress,
    setJobError,
    requestPause,
    requestCancel,
    clearJobControl,
    getSelectedSpools,
  } = jobStore;

  const hs = hardwareState;
  const isConnected = status === 'connected';
  const printerReady = isConnected && (!hs || (!hs.outOfPaper && !hs.coverOpen && !hs.overheat));
  const isIdle = jobStatus === 'idle' || jobStatus === 'done' || jobStatus === 'error';
  const isPrinting = jobStatus === 'printing';
  const isPausing = jobStatus === 'pausing';
  const isPaused = jobStatus === 'paused';

  const labelProfile = settings.getActiveLabelProfile();
  const printerProfile = settings.getActivePrinterProfile();
  const selectedSpools = getSelectedSpools();
  const selectedCount = selectedSpools.length;

  function getAlignment() {
    if (!labelProfile || !printerProfile) return null;
    const a = computeAlignment(labelProfile, printerProfile);
    if (skipRetract) return { ...a, startRetract: 0 };
    return a;
  }

  async function buildAndPrint(spoolsToRender: typeof selectedSpools, oneByOne: boolean) {
    const printer = getPrinterInstance();
    const alignment = getAlignment();
    if (!printer || !alignment) return;

    setJobStatus('printing');
    setJobProgress({ current: 0, total: selectedCount });
    clearJobControl();

    let labels: RenderedLabel[];
    try {
      labels = await Promise.all(
        spoolsToRender.map((spool) => renderLabel(spool, labelProfile!, printerProfile!, settings.spoolmanUrl))
      );
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Render failed');
      setJobStatus('error');
      return;
    }

    renderedLabels.current = labels;
    resumeIndex.current = 0;

    const toPrint = oneByOne ? [labels[0]] : labels;

    await runPrintLoop(printer, toPrint, alignment, speed, energy, {
      onProgress: (current, total) => setJobProgress({ current, total }),
      onPaused: (idx) => {
        resumeIndex.current = idx;
        setJobStatus('paused');
      },
      onDone: () => {
        if (oneByOne && labels.length > 1) {
          resumeIndex.current = 1;
          setJobStatus('paused');
        } else {
          toast.success('All labels printed!');
          setJobStatus('idle');
        }
      },
      onError: (err) => { setJobError(err.message); setJobStatus('error'); },
      shouldPause: () => jobStore._shouldPause,
      shouldCancel: () => jobStore._shouldCancel,
    });
  }

  async function printNext() {
    const printer = getPrinterInstance();
    const alignment = getAlignment();
    if (!printer || !alignment) return;
    clearJobControl();

    const labels = renderedLabels.current;
    const idx = resumeIndex.current;
    if (idx >= labels.length) {
      toast.success('All labels printed!');
      setJobStatus('idle');
      return;
    }

    setJobStatus('printing');

    await runPrintLoop(printer, labels, alignment, speed, energy, {
      onProgress: (current, total) => setJobProgress({ current, total }),
      onPaused: (newIdx) => { resumeIndex.current = newIdx; setJobStatus('paused'); },
      onDone: () => { toast.success('All labels printed!'); setJobStatus('idle'); },
      onError: (err) => { setJobError(err.message); setJobStatus('error'); },
      shouldPause: () => jobStore._shouldPause,
      shouldCancel: () => jobStore._shouldCancel,
    }, idx);
  }

  async function printAllRemaining() {
    const printer = getPrinterInstance();
    const alignment = getAlignment();
    if (!printer || !alignment) return;
    clearJobControl();

    const labels = renderedLabels.current;
    const idx = resumeIndex.current;
    if (idx >= labels.length) {
      toast.success('All labels printed!');
      setJobStatus('idle');
      return;
    }

    const remaining = labels.slice(idx);
    setJobStatus('printing');

    await runPrintLoop(printer, remaining, alignment, speed, energy, {
      onProgress: (current, total) => setJobProgress({ current: idx + current, total: labels.length }),
      onPaused: (newIdx) => { resumeIndex.current = idx + newIdx; setJobStatus('paused'); },
      onDone: () => { toast.success('All labels printed!'); setJobStatus('idle'); },
      onError: (err) => { setJobError(err.message); setJobStatus('error'); },
      shouldPause: () => jobStore._shouldPause,
      shouldCancel: () => jobStore._shouldCancel,
    });
  }

  const progressPct = jobProgress.total > 0
    ? Math.round((jobProgress.current / jobProgress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Idle: print buttons */}
      {isIdle && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => buildAndPrint(selectedSpools, false)}
              disabled={!printerReady || selectedCount === 0}
              className="flex-1"
            >
              <Play className="h-4 w-4" />
              {selectedCount === 1
                ? 'Print label'
                : `Print all ${selectedCount > 0 ? `${selectedCount} ` : ''}labels`}
            </Button>
            {selectedCount !== 1 && (
              <Button
                variant="outline"
                onClick={() => buildAndPrint(selectedSpools, true)}
                disabled={!printerReady || selectedCount === 0}
              >
                <SkipForward className="h-4 w-4" />
                One by one
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={skipRetract}
              onCheckedChange={(v) => setSkipRetract(!!v)}
              className="h-3.5 w-3.5"
            />
            Skip start retraction
          </label>
        </div>
      )}

      {/* Printing / pausing */}
      {(isPrinting || isPausing) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            {isPausing ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finishing label…
              </span>
            ) : (
              <span>Label {jobProgress.current} of {jobProgress.total}</span>
            )}
            <span className="tabular-nums text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex gap-2">
            {!isPausing && (
              <Button variant="outline" size="sm" onClick={() => { requestPause(); setJobStatus('pausing'); }}>
                <Pause className="h-4 w-4" /> Pause
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => { requestCancel(); }}>
              <Square className="h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Paused */}
      {isPaused && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Paused — {resumeIndex.current} of {jobProgress.total} printed
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={printNext} disabled={!printerReady}>
              <SkipForward className="h-4 w-4" /> Print next
            </Button>
            {resumeIndex.current < (renderedLabels.current.length - 1) && (
              <Button size="sm" variant="outline" onClick={printAllRemaining} disabled={!printerReady}>
                <PlayCircle className="h-4 w-4" /> Print all remaining
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { clearJobControl(); setJobStatus('idle'); }}
            >
              <Square className="h-4 w-4" /> Abort
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {jobStatus === 'error' && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-destructive">{jobStore.jobError}</p>
          <Button variant="outline" size="sm" onClick={() => setJobStatus('idle')}>Dismiss</Button>
        </div>
      )}
    </div>
  );
}
