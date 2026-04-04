import { create } from 'zustand';
import type { ISpool } from '@/types/spoolman';
import type { JobStatus, PrintJobProgress } from '@/types/printer';

interface PrintJobState {
  spools: ISpool[];
  selectedSpoolIds: Set<number>;
  searchQuery: string;
  showArchived: boolean;
  jobStatus: JobStatus;
  jobProgress: PrintJobProgress;
  jobError: string | null;
  // control flags (checked by print loop)
  _shouldPause: boolean;
  _shouldCancel: boolean;

  setSpools: (spools: ISpool[]) => void;
  toggleSpool: (id: number) => void;
  selectAllVisible: (ids: number[]) => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setShowArchived: (show: boolean) => void;
  setJobStatus: (status: JobStatus) => void;
  setJobProgress: (progress: PrintJobProgress) => void;
  setJobError: (err: string | null) => void;
  requestPause: () => void;
  requestCancel: () => void;
  clearJobControl: () => void;
  getSelectedSpools: () => ISpool[];
}

export const usePrintJobStore = create<PrintJobState>()((set, get) => ({
  spools: [],
  selectedSpoolIds: new Set(),
  searchQuery: '',
  showArchived: false,
  jobStatus: 'idle',
  jobProgress: { current: 0, total: 0 },
  jobError: null,
  _shouldPause: false,
  _shouldCancel: false,

  setSpools: (spools) => set({ spools }),

  toggleSpool: (id) =>
    set((state) => {
      const next = new Set(state.selectedSpoolIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedSpoolIds: next };
    }),

  selectAllVisible: (ids) =>
    set((state) => {
      const next = new Set(state.selectedSpoolIds);
      ids.forEach((id) => next.add(id));
      return { selectedSpoolIds: next };
    }),

  clearSelection: () => set({ selectedSpoolIds: new Set() }),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowArchived: (show) => set({ showArchived: show }),
  setJobStatus: (status) => set({ jobStatus: status }),
  setJobProgress: (progress) => set({ jobProgress: progress }),
  setJobError: (err) => set({ jobError: err }),
  requestPause: () => set({ _shouldPause: true }),
  requestCancel: () => set({ _shouldCancel: true }),
  clearJobControl: () => set({ _shouldPause: false, _shouldCancel: false }),

  getSelectedSpools: () => {
    const { spools, selectedSpoolIds } = get();
    return spools.filter((s) => selectedSpoolIds.has(s.id));
  },
}));
