import React, { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

interface HoldButtonProps extends ButtonProps {
  onHoldTick: () => void;
  tickIntervalMs?: number;
}

export function HoldButton({
  onHoldTick,
  tickIntervalMs = 100,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  children,
  ...props
}: HoldButtonProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(e);
      onHoldTick();
      intervalRef.current = setInterval(onHoldTick, tickIntervalMs);
    },
    [onHoldTick, tickIntervalMs, onPointerDown]
  );

  const stopHold = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (e.type === 'pointerup') onPointerUp?.(e as React.PointerEvent<HTMLButtonElement>);
      if (e.type === 'pointerleave') onPointerLeave?.(e as React.PointerEvent<HTMLButtonElement>);
    },
    [onPointerUp, onPointerLeave]
  );

  return (
    <Button
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      {...props}
    >
      {children}
    </Button>
  );
}
