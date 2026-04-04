import React, { useState } from 'react';
import {
  Printer, Bluetooth, BluetoothOff, Loader2,
  FileText, FileWarning, PanelTop, PanelTopOpen,
  Thermometer, ThermometerSun, BatteryFull, BatteryLow,
  ChevronUp, ChevronDown, RefreshCw,
} from 'lucide-react';
import { usePrinterStore, getPrinterInstance } from '@/store/printerStore';
import { debugLog } from '@/store/debugStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HoldButton } from '@/components/HoldButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function StatusPill({
  ok,
  okIcon,
  badIcon,
  label,
  badLabel,
}: {
  ok: boolean | null;
  okIcon: React.ReactNode;
  badIcon: React.ReactNode;
  label: string;
  badLabel?: string;
}) {
  const displayIcon = ok === false ? badIcon : okIcon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors',
            ok === null
              ? 'border-border text-muted-foreground/50'
              : ok
              ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          {displayIcon}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {ok === null ? label + ': unknown' : ok ? label + ': OK' : (badLabel ?? label + ': Problem')}
      </TooltipContent>
    </Tooltip>
  );
}

export function PrinterControlCard() {
  const printer = usePrinterStore();
  const [feedAmount, setFeedAmount] = useState(5);
  const [isPolling, setIsPolling] = useState(false);

  const { status, deviceName, hardwareState, errorMessage, connect, disconnect } = printer;
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const hs = hardwareState;
  const printerReady = isConnected && (!hs || (!hs.outOfPaper && !hs.coverOpen && !hs.overheat));

  async function handleFeedTick() {
    const p = getPrinterInstance();
    if (!p) return;
    debugLog(`Manual feed ${feedAmount} lines`);
    await p.feed(feedAmount);
    await p.getDeviceState();
  }

  async function handleRetractTick() {
    const p = getPrinterInstance();
    if (!p) return;
    debugLog(`Manual retract ${feedAmount} lines`);
    await p.retract(feedAmount);
    await p.getDeviceState();
  }

  async function handleRefreshStatus() {
    if (!isConnected) return;
    setIsPolling(true);
    await printer.pollHardwareState();
    setIsPolling(false);
  }

  const statusDotColor =
    status === 'connected'
      ? 'bg-green-500'
      : status === 'connecting'
      ? 'bg-yellow-500 animate-pulse'
      : status === 'error'
      ? 'bg-red-500'
      : 'bg-muted-foreground/50';

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: status dot + printer name + connect button */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', statusDotColor)} />
        <Printer className="h-4 w-4 flex-shrink-0 text-primary" />
        <span className="font-medium text-sm truncate flex-1 min-w-0">
          {isConnected
            ? (deviceName ?? 'Cat Printer')
            : isConnecting
            ? 'Connecting…'
            : status === 'error'
            ? 'Error'
            : 'Disconnected'}
        </span>
        <Button
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting}
          variant={isConnected ? 'destructive' : 'default'}
          size="sm"
          className="flex-shrink-0"
        >
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isConnected ? (
            <BluetoothOff className="h-4 w-4" />
          ) : (
            <Bluetooth className="h-4 w-4" />
          )}
          <span className="ml-1">
            {isConnected ? 'Disconnect' : isConnecting ? 'Connecting…' : 'Connect'}
          </span>
        </Button>
      </div>

      {/* Row 2: status pills + refresh */}
      {isConnected && (
        <div className="flex items-center gap-1">
          <StatusPill
            ok={hs ? !hs.outOfPaper : null}
            okIcon={<FileText className="h-3.5 w-3.5" />}
            badIcon={<FileWarning className="h-3.5 w-3.5" />}
            label="Paper"
            badLabel="Out of paper"
          />
          <StatusPill
            ok={hs ? !hs.coverOpen : null}
            okIcon={<PanelTop className="h-3.5 w-3.5" />}
            badIcon={<PanelTopOpen className="h-3.5 w-3.5" />}
            label="Cover"
            badLabel="Cover open"
          />
          <StatusPill
            ok={hs ? !hs.overheat : null}
            okIcon={<Thermometer className="h-3.5 w-3.5" />}
            badIcon={<ThermometerSun className="h-3.5 w-3.5" />}
            label="Temperature"
            badLabel="Overheated"
          />
          <StatusPill
            ok={hs ? !hs.lowPower : null}
            okIcon={<BatteryFull className="h-3.5 w-3.5" />}
            badIcon={<BatteryLow className="h-3.5 w-3.5" />}
            label="Battery"
            badLabel="Low battery"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-auto"
                onClick={handleRefreshStatus}
                disabled={isPolling}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isPolling && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh status</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      {/* Feed / Retract row */}
      <div className="flex items-center gap-2">
        <HoldButton
          onHoldTick={handleFeedTick}
          disabled={!printerReady}
          variant="outline"
          size="sm"
          className="flex-1 gap-1"
        >
          <ChevronUp className="h-4 w-4" />
          Feed
        </HoldButton>
        <HoldButton
          onHoldTick={handleRetractTick}
          disabled={!printerReady}
          variant="outline"
          size="sm"
          className="flex-1 gap-1"
        >
          <ChevronDown className="h-4 w-4" />
          Retract
        </HoldButton>
        <Input
          type="number"
          min={1}
          max={500}
          value={feedAmount}
          onChange={(e) => setFeedAmount(Math.max(1, Number(e.target.value)))}
          className="w-16 h-8 text-xs text-center"
        />
        <span className="text-xs text-muted-foreground">lines</span>
      </div>
    </div>
  );
}
