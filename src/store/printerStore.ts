import { create } from 'zustand';
import { CatPrinter } from '@opuu/cat-printer';
import type { ConnectionStatus, PrinterHardwareState } from '@/types/printer';
import { debugLog, debugError } from '@/store/debugStore';
import type { PrinterProfile } from '@/types/profiles';

// Module-level toast callback
type ToastType = 'success' | 'info' | 'error';
type ToastCallback = (type: ToastType, message: string) => void;
let toastFn: ToastCallback | null = null;
export function setPrinterToastCallback(cb: ToastCallback): void { toastFn = cb; }
function notify(type: ToastType, msg: string) { toastFn?.(type, msg); }

// Module-level printer instance (not serializable, kept outside Zustand)
let printerInstance: CatPrinter | null = null;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

export function getPrinterInstance(): CatPrinter | null {
  return printerInstance;
}

interface PrinterState {
  status: ConnectionStatus;
  deviceName: string | null;
  errorMessage: string | null;
  hardwareState: PrinterHardwareState | null;
  speed: number;
  energy: number;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setSpeed: (speed: number) => void;
  setEnergy: (energy: number) => void;
  applySpeedEnergy: () => Promise<void>;
  pollHardwareState: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>()((set, get) => ({
  status: 'disconnected',
  deviceName: null,
  errorMessage: null,
  hardwareState: null,
  speed: 64,
  energy: 24000,

  connect: async () => {
    if (!navigator.bluetooth) {
      set({
        status: 'error',
        errorMessage: 'Web Bluetooth is not available. Use Chrome, Edge, or Opera.',
      });
      return;
    }

    set({ status: 'connecting', errorMessage: null });
    debugLog('Connecting...');

    try {
      const { speed, energy } = get();
      printerInstance = new CatPrinter({ debug: true, speed, energy });
      await printerInstance.connect();

      const modelName = (printerInstance as unknown as { modelName: string }).modelName ?? 'Cat Printer';
      set({ status: 'connected', deviceName: modelName });
      debugLog(`Connected to ${modelName}`);
      notify('success', `Connected to ${modelName}`);

      // Start polling hardware state
      if (pollIntervalId) clearInterval(pollIntervalId);
      pollIntervalId = setInterval(async () => {
        if (!printerInstance || !printerInstance.isConnected()) {
          clearInterval(pollIntervalId!);
          pollIntervalId = null;
          set({ status: 'disconnected', hardwareState: null });
          notify('info', 'Printer disconnected');
          return;
        }
        try {
          const state = await printerInstance.getDeviceState();
          const prev = get().hardwareState;
          if (JSON.stringify(prev) !== JSON.stringify(state)) {
            set({ hardwareState: state });
            debugLog(`Hardware state changed: ${JSON.stringify(state)}`);
          }
        } catch {
          // ignore polling errors
        }
      }, 1000);
    } catch (err) {
      printerInstance = null;
      const msg = err instanceof Error ? err.message : 'Connection failed';
      set({
        status: 'error',
        errorMessage: msg,
      });
      debugError(`Connection error: ${msg}`);
      notify('error', msg);
    }
  },

  disconnect: async () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (printerInstance) {
      try {
        await printerInstance.disconnect();
      } catch {
        // ignore
      }
      printerInstance = null;
    }
    set({ status: 'disconnected', deviceName: null, hardwareState: null });
    debugLog('Disconnected');
    notify('info', 'Disconnected');
  },

  setSpeed: (speed) => set({ speed }),
  setEnergy: (energy) => set({ energy }),

  applySpeedEnergy: async () => {
    if (!printerInstance || !printerInstance.isConnected()) return;
    const { speed, energy } = get();
    await printerInstance.prepare(speed, energy);
  },

  pollHardwareState: async () => {
    if (!printerInstance || !printerInstance.isConnected()) return;
    try {
      const state = await printerInstance.getDeviceState();
      set({ hardwareState: state });
    } catch {
      // ignore
    }
  },
}));
