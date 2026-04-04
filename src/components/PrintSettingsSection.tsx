import React from 'react';
import { usePrinterStore } from '@/store/printerStore';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function PrintSettingsSection() {
  const { speed, energy, setSpeed, setEnergy, applySpeedEnergy, status } = usePrinterStore();
  const connected = status === 'connected';

  return (
    <div className="flex flex-col gap-3">
      <SliderRow
        label="Speed"
        value={speed}
        min={8}
        max={64}
        step={1}
        onChange={setSpeed}
        onCommit={connected ? applySpeedEnergy : undefined}
      />
      <SliderRow
        label="Energy"
        value={energy}
        min={16000}
        max={50000}
        step={100}
        onChange={setEnergy}
        onCommit={connected ? applySpeedEnergy : undefined}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className={cn('text-xs tabular-nums text-muted-foreground')}>{value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={onCommit ? () => onCommit() : undefined}
      />
    </div>
  );
}
