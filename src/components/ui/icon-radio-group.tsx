import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface IconRadioOption<T extends string> {
  value: T;
  icon: React.ReactNode;
  label: string;
}

interface IconRadioGroupProps<T extends string> {
  value: T;
  options: IconRadioOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function IconRadioGroup<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: IconRadioGroupProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-input overflow-hidden',
        className
      )}
    >
      {options.map((opt, i) => (
        <Tooltip key={opt.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm',
                i > 0 && 'border-l border-input',
                value === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-pressed={value === opt.value}
              aria-label={opt.label}
            >
              {opt.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent>{opt.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
