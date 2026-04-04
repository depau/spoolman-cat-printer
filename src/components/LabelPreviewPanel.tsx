import React from 'react';
import { usePrintJobStore } from '@/store/printJobStore';
import { useSettingsStore } from '@/store/settingsStore';
import { LabelPreview } from '@/components/LabelPreview';
import type { LabelPreviewMode, LabelPrintState } from '@/components/LabelPreview';
import type { ISpool } from '@/types/spoolman';
import { spoolDisplayName } from '@/lib/utils';

function getLabelPrintState(
  spoolId: number,
  jobStatus: string,
  progress: { current: number; total: number },
  selectedSpools: ISpool[]
): LabelPrintState {
  if (jobStatus !== 'printing' && jobStatus !== 'pausing' && jobStatus !== 'paused') return 'pending';
  const idx = selectedSpools.findIndex((s) => s.id === spoolId);
  if (idx < 0) return 'pending';
  const labelNum = idx + 1;
  if (labelNum < progress.current) return 'done';
  if (labelNum === progress.current) return 'printing';
  return 'pending';
}

interface LabelPreviewPanelProps {
  mode: LabelPreviewMode;
}

export function LabelPreviewPanel({ mode }: LabelPreviewPanelProps) {
  const { getSelectedSpools, jobStatus, jobProgress } = usePrintJobStore();
  const { getActiveLabelProfile, getActivePrinterProfile, spoolmanUrl } = useSettingsStore();

  const selectedSpools = getSelectedSpools();
  const labelProfile = getActiveLabelProfile();
  const printerProfile = getActivePrinterProfile();

  if (selectedSpools.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Select spools to see label previews.
      </p>
    );
  }

  if (!labelProfile || !printerProfile) return null;

  const widthMm = labelProfile.widthMm;

  return (
    <div className="flex flex-wrap gap-3">
      {selectedSpools.map((spool) => {
        const printState = getLabelPrintState(spool.id, jobStatus, jobProgress, selectedSpools);
        const spoolName = spoolDisplayName(spool);

        return (
          <div
            key={spool.id}
            className="flex flex-col gap-1.5 p-2 border rounded-lg bg-card shadow-sm min-w-0"
            style={{ width: `${widthMm}mm`, maxWidth: '100%' }}
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {spool.filament.color_hex && (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border flex-shrink-0"
                  style={{ backgroundColor: `#${spool.filament.color_hex}` }}
                />
              )}
              <span className="font-medium text-foreground">#{spool.id}</span>
              <span className="truncate">{spoolName}</span>
            </div>
            <LabelPreview
              spool={spool}
              labelProfile={labelProfile}
              printerProfile={printerProfile}
              spoolmanHost={spoolmanUrl}
              mode={mode}
              printState={printState}
            />
          </div>
        );
      })}
    </div>
  );
}
