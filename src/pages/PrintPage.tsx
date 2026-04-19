import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Bookmark } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { usePrinterStore, getPrinterInstance } from '@/store/printerStore';
import { PrinterControlCard } from '@/components/PrinterControlCard';
import { SpoolList } from '@/components/SpoolList';
import { LabelPreviewPanel } from '@/components/LabelPreviewPanel';
import { PrintControls } from '@/components/PrintControls';
import { PrintSettingsSection } from '@/components/PrintSettingsSection';
import { DebugLog } from '@/components/DebugLog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PreviewModeToggle } from '@/components/LabelPreview';
import type { LabelPreviewMode } from '@/components/LabelPreview';
import { useDebugStore } from '@/store/debugStore';
import { generateId } from '@/lib/utils';
import { debugLog } from '@/store/debugStore';

// ── Layout helpers ────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/** Non-collapsible section card with an optional action widget in the header */
function SectionPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex w-full items-center justify-between px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {action}
      </div>
      <div className="px-3 pb-3">{children}</div>
    </div>
  );
}

// ── Profiles section ──────────────────────────────────────────────────────────

function ProfilesSection({ onEditSettings }: { onEditSettings: (tab?: string) => void }) {
  const settings = useSettingsStore();
  const printer = usePrinterStore();

  const {
    labelProfiles,
    printerProfiles,
    activeLabelProfileId,
    activePrinterProfileId,
    setActiveLabelProfileId,
    setActivePrinterProfileId,
    upsertLabelProfile,
    upsertPrinterProfile,
    getActiveLabelProfile,
    getActivePrinterProfile,
  } = settings;

  const { status, deviceName } = printer;
  const isConnected = status === 'connected';

  function newLabelProfile() {
    const base = getActiveLabelProfile();
    if (!base) return;
    const newP = { ...base, id: generateId(), name: 'New Label Profile' };
    upsertLabelProfile(newP);
    setActiveLabelProfileId(newP.id);
    onEditSettings('label-profiles');
  }

  function newPrinterProfile() {
    const base = getActivePrinterProfile();
    if (!base) return;
    const newP = { ...base, id: generateId(), name: 'New Printer Profile' };
    upsertPrinterProfile(newP);
    setActivePrinterProfileId(newP.id);
    onEditSettings('printer-profiles');
  }

  function handleSetDefaultPrinter() {
    const activePrinter = getActivePrinterProfile();
    if (!activePrinter || !deviceName) return;
    if (!activePrinter.associatedDeviceNames.includes(deviceName)) {
      upsertPrinterProfile({
        ...activePrinter,
        associatedDeviceNames: [...activePrinter.associatedDeviceNames, deviceName],
      });
      debugLog(`Set ${deviceName} as default for profile "${activePrinter.name}"`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Label Profile</Label>
        <div className="flex gap-1">
          <Select value={activeLabelProfileId} onValueChange={(v) => { if (v !== '__new__') setActiveLabelProfileId(v); }}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labelProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
              <SelectItem value="__new__" onSelect={newLabelProfile}>
                <span className="flex items-center gap-1 text-primary">
                  <Plus className="h-3 w-3" /> New profile…
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => onEditSettings('label-profiles')} title="Edit label profile">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Printer Profile</Label>
        <div className="flex gap-1">
          <Select value={activePrinterProfileId} onValueChange={(v) => { if (v !== '__new__') setActivePrinterProfileId(v); }}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {printerProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
              <SelectItem value="__new__" onSelect={newPrinterProfile}>
                <span className="flex items-center gap-1 text-primary">
                  <Plus className="h-3 w-3" /> New profile…
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => onEditSettings('printer-profiles')} title="Edit printer profile">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {isConnected && deviceName && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetDefaultPrinter}
              className="w-full gap-1.5 text-xs mt-1"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Set as default for printer
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Associate "{deviceName}" with the active printer profile
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PrintPage({ onNavigateSettings }: { onNavigateSettings: (tab?: string) => void }) {
  const { showDebugLog } = useSettingsStore();
  const { clear: clearDebugLog } = useDebugStore();
  const [previewMode, setPreviewMode] = useState<LabelPreviewMode>('png');

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-4 p-3 lg:p-4 max-w-7xl mx-auto w-full">
      {/*
        DOM order: right column first (printer card + preview) so it appears first on mobile.
        On desktop, CSS order flips left column back to the left via lg:order-first.
      */}

      {/* Right column (main): printer card + print controls + preview + debug log */}
      <div className="flex flex-col gap-3 flex-1 min-w-0 lg:order-2">
        {/* Printer card + print controls merged, non-collapsible */}
        <div className="rounded-lg border bg-card p-3 flex flex-col gap-3">
          <PrinterControlCard />
          <div className="border-t pt-3">
            <PrintControls />
          </div>
        </div>

        {/* Preview — non-collapsible; HTML/PNG toggle in header */}
        <SectionPanel
          title="Preview"
          action={<PreviewModeToggle mode={previewMode} onChange={setPreviewMode} />}
        >
          <div className="py-2">
            <LabelPreviewPanel mode={previewMode} />
          </div>
        </SectionPanel>

        {/* Debug log — non-collapsible; Clear button in header */}
        {showDebugLog && (
          <SectionPanel
            title="Debug Log"
            action={
              <Button size="sm" variant="outline" onClick={clearDebugLog} className="h-6 text-xs px-2">
                Clear
              </Button>
            }
          >
            <DebugLog />
          </SectionPanel>
        )}
      </div>

      {/* Left column (sidebar): profiles + settings + spools */}
      <div className="flex flex-col gap-3 lg:w-80 xl:w-96 flex-shrink-0 lg:order-1">
        <CollapsibleSection title="Profiles">
          <ProfilesSection onEditSettings={onNavigateSettings} />
        </CollapsibleSection>

        <CollapsibleSection title="Print Settings" defaultOpen={false}>
          <PrintSettingsSection />
        </CollapsibleSection>

        <CollapsibleSection title="Spools">
          <SpoolList />
        </CollapsibleSection>
      </div>
    </div>
  );
}
