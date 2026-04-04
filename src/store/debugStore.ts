import {create} from 'zustand';

interface DebugMessage {
  id: number;
  ts: string;  // ISO timestamp
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface DebugState {
  messages: DebugMessage[];
  addMessage: (level: DebugMessage['level'], message: string) => void;
  clear: () => void;
}

let _msgCounter = 0;

export const useDebugStore = create<DebugState>()((set) => ({
  messages: [],
  addMessage: (level, message) => {
    const entry: DebugMessage = {
      id: ++_msgCounter,
      ts: new Date().toLocaleTimeString(),
      level,
      message,
    };
    console.debug(`[SpoolPrint ${level}] ${message}`);
    set((state) => ({
      messages: [...state.messages.slice(-99), entry],
    }));
  },
  clear: () => set({messages: []}),
}));

function asString(v: any): string {
  if (typeof v === 'object' || Array.isArray(v)) {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

// Forward SDK [CatPrinter] console.log messages into the in-app debug panel
const _origConsoleLog = console.log;
console.log = (...args: unknown[]) => {
  _origConsoleLog(...args);
  if (args.length > 0 && args[0] === '[CatPrinter]') {
    useDebugStore.getState().addMessage('info', args.slice(1).map(asString).join(' '));
  }
};

export function debugLog(message: string) {
  useDebugStore.getState().addMessage('info', message);
}

export function debugWarn(message: string) {
  useDebugStore.getState().addMessage('warn', message);
}

export function debugError(message: string) {
  useDebugStore.getState().addMessage('error', message);
}
