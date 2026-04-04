import React, { useState } from 'react';
import { Plus, Trash2, Copy, X } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import type { PrinterProfile } from '@/types/profiles';
import { generateId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ProfileForm({
  profile,
  onChange,
}: {
  profile: PrinterProfile;
  onChange: (p: PrinterProfile) => void;
}) {
  function update(patch: Partial<PrinterProfile>) {
    onChange({ ...profile, ...patch });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input value={profile.name} onChange={(e) => update({ name: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>DPI</Label>
          <Input
            type="number"
            value={profile.dpi}
            onChange={(e) => update({ dpi: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Printable Width (px)</Label>
          <Input
            type="number"
            value={profile.printableWidthPx}
            onChange={(e) => update({ printableWidthPx: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Default Speed</Label>
          <Input
            type="number"
            min={1}
            max={255}
            value={profile.defaultSpeed}
            onChange={(e) => update({ defaultSpeed: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Default Energy</Label>
          <Input
            type="number"
            min={1000}
            max={65535}
            value={profile.defaultEnergy}
            onChange={(e) => update({ defaultEnergy: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Blade Offset (lines)</Label>
        <Input
          type="number"
          value={profile.bladeOffsetLines}
          onChange={(e) => update({ bladeOffsetLines: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Distance in print lines from the print head to the cutting blade. Default: 85.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Associated Device Names</Label>
        {profile.associatedDeviceNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.associatedDeviceNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium"
              >
                {name}
                <button
                  type="button"
                  onClick={() =>
                    update({
                      associatedDeviceNames: profile.associatedDeviceNames.filter(
                        (n) => n !== name
                      ),
                    })
                  }
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No devices associated.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Connect a printer and use the &lsquo;Set as default&rsquo; button on the Print page to add device names here.
        </p>
      </div>
    </div>
  );
}

export function PrinterProfileEditor() {
  const { printerProfiles, activePrinterProfileId, setActivePrinterProfileId, upsertPrinterProfile, deletePrinterProfile } = useSettingsStore();

  const [draft, setDraft] = useState<PrinterProfile | null>(null);
  const selected = draft ?? printerProfiles.find((p) => p.id === activePrinterProfileId) ?? printerProfiles[0];

  function handleSelect(id: string) {
    setActivePrinterProfileId(id);
    setDraft(null);
  }

  function handleChange(p: PrinterProfile) {
    setDraft(p);
  }

  function handleSave() {
    if (draft) {
      upsertPrinterProfile(draft);
      setDraft(null);
    }
  }

  function handleAdd() {
    const newProfile: PrinterProfile = {
      id: generateId(),
      name: 'New Printer Profile',
      dpi: 203,
      printableWidthPx: 384,
      printableHeightPx: null,
      defaultSpeed: 64,
      defaultEnergy: 24000,
      bladeOffsetLines: 85,
      associatedDeviceNames: [],
    };
    upsertPrinterProfile(newProfile);
    setActivePrinterProfileId(newProfile.id);
    setDraft(null);
  }

  function handleDuplicate() {
    if (!selected) return;
    const dup: PrinterProfile = { ...selected, id: generateId(), name: `${selected.name} (copy)` };
    upsertPrinterProfile(dup);
    setActivePrinterProfileId(dup.id);
    setDraft(null);
  }

  function handleDelete() {
    if (!selected || printerProfiles.length <= 1) return;
    deletePrinterProfile(selected.id);
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Profile list */}
      <div className="lg:w-52 flex-shrink-0">
        <div className="flex flex-col gap-1 rounded-md border overflow-hidden">
          {printerProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`text-left px-3 py-2 text-sm transition-colors hover:bg-accent ${
                p.id === (draft?.id ?? activePrinterProfileId) ? 'bg-accent font-medium' : ''
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-2">
          <Button size="icon" variant="outline" onClick={handleAdd} title="New">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={handleDuplicate} title="Duplicate">
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleDelete}
            disabled={printerProfiles.length <= 1}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {selected && (
          <div className="flex flex-col gap-4">
            <ProfileForm profile={draft ?? selected} onChange={handleChange} />
            {draft && (
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save</Button>
                <Button variant="outline" onClick={() => setDraft(null)}>Discard</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
