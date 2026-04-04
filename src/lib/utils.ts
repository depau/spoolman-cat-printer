import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ISpool } from '@/types/spoolman';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function spoolDisplayName(spool: ISpool): string {
  const parts: string[] = [];
  if (spool.filament.vendor?.name) parts.push(spool.filament.vendor.name);
  if (spool.filament.name) parts.push(spool.filament.name);
  if (spool.filament.material && !parts.some((p) => p.includes(spool.filament.material!)))
    parts.push(spool.filament.material);
  return parts.join(' ') || `Spool #${spool.id}`;
}
