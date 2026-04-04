export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrinterHardwareState {
  outOfPaper: boolean;
  coverOpen: boolean;
  overheat: boolean;
  lowPower: boolean;
  paused: boolean;
  busy: boolean;
}

export type JobStatus = 'idle' | 'printing' | 'pausing' | 'paused' | 'error' | 'done';

export interface PrintJobProgress {
  current: number;
  total: number;
}
