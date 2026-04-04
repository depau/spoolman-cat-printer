import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LabelProfile, PrinterProfile } from '@/types/profiles';
import { generateId } from '@/lib/utils';
import { normalizeUrl } from '@/lib/spoolmanApi';

const DEFAULT_LABEL_TEMPLATE = `# {{filament.vendor.name}}, {{filament.material}}
**#{{id}}** • {{#ifval filament.name}}{{filament.name}}{{/ifval}} {{#ifval initial_weight}}({{initial_weight}}g){{/ifval}}


{{#ifval filament.settings_extruder_temp}}ET: {{filament.settings_extruder_temp}}°C{{/ifval}}
{{#ifval filament.settings_bed_temp}}BT: {{filament.settings_bed_temp}}°C{{/ifval}}
{{#ifval lot_nr}}Lot Nr: {{lot_nr}}{{/ifval}}
{{#ifval comment}}{{comment}}{{/ifval}}
{{#ifval filament.comment}}{{filament.comment}}{{/ifval}}
{{#ifval filament.vendor.comment}}{{filament.vendor.comment}}{{/ifval}}
`;

function makeDefaultLabelProfile(): LabelProfile {
  return {
    id: generateId(),
    name: '50×30 Label',
    widthMm: 50,
    heightMm: 30,
    orientation: 'portrait',
    gapMm: 3,
    margins: { top: 2, right: 2, bottom: 2, left: 2 },
    layout: 'qr-left-text-right',
    qrScaleFactor: 4,
    labelTemplate: DEFAULT_LABEL_TEMPLATE,
    styleMode: 'easy',
    easyFontFamily: 'sans-serif',
    easyFontSizePx: 20,
    easyLineHeight: 1.2,
    easyTextAlign: 'left',
    advancedCss: '',
    dithering: 'floyd-steinberg',
    ditheringThreshold: 128,
    easyVerticalAlign: 'center',
    qrContentMode: 'web-url',
    qrContentTemplate: '{{spoolman_host}}/spool/{{id}}',
    borderWidthPx: 0,
    borderColor: '#000000',
    columnGapMm: 2,
  };
}

function makeDefaultPrinterProfile(): PrinterProfile {
  return {
    id: generateId(),
    name: 'Cat Printer 203dpi',
    dpi: 203,
    printableWidthPx: 384,
    printableHeightPx: null,
    defaultSpeed: 64,
    defaultEnergy: 24000,
    bladeOffsetLines: 85,
    associatedDeviceNames: [],
  };
}

export interface ExportedSettings {
  version: 1;
  spoolmanUrl: string;
  labelProfiles: LabelProfile[];
  printerProfiles: PrinterProfile[];
  activeLabelProfileId: string;
  activePrinterProfileId: string;
  theme: 'light' | 'dark' | 'system';
}

interface SettingsState {
  spoolmanUrl: string;
  labelProfiles: LabelProfile[];
  printerProfiles: PrinterProfile[];
  activeLabelProfileId: string;
  activePrinterProfileId: string;
  theme: 'light' | 'dark' | 'system';
  showDebugLog: boolean;

  setSpoolmanUrl: (url: string) => void;
  setActiveLabelProfileId: (id: string) => void;
  setActivePrinterProfileId: (id: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setShowDebugLog: (show: boolean) => void;
  upsertLabelProfile: (profile: LabelProfile) => void;
  deleteLabelProfile: (id: string) => void;
  upsertPrinterProfile: (profile: PrinterProfile) => void;
  deletePrinterProfile: (id: string) => void;
  getActiveLabelProfile: () => LabelProfile | undefined;
  getActivePrinterProfile: () => PrinterProfile | undefined;
  exportSettings: () => ExportedSettings;
  importSettings: (data: ExportedSettings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => {
      const defaultLabel = makeDefaultLabelProfile();
      const defaultPrinter = makeDefaultPrinterProfile();

      return {
        spoolmanUrl: (() => {
          // Default to the parent directory of the current URL (useful when hosted at spoolman.xyz/labels)
          try {
            const url = new URL('..', window.location.href);
            return url.origin + normalizeUrl(url.pathname);
          } catch {
            return 'http://localhost:7912';
          }
        })(),
        labelProfiles: [defaultLabel],
        printerProfiles: [defaultPrinter],
        activeLabelProfileId: defaultLabel.id,
        activePrinterProfileId: defaultPrinter.id,
        theme: 'system',
        showDebugLog: false,

        setSpoolmanUrl: (url) => set({ spoolmanUrl: url }),
        setActiveLabelProfileId: (id) => set({ activeLabelProfileId: id }),
        setActivePrinterProfileId: (id) => set({ activePrinterProfileId: id }),
        setTheme: (theme) => set({ theme }),
        setShowDebugLog: (show) => set({ showDebugLog: show }),

        upsertLabelProfile: (profile) =>
          set((state) => {
            const idx = state.labelProfiles.findIndex((p) => p.id === profile.id);
            if (idx >= 0) {
              const profiles = [...state.labelProfiles];
              profiles[idx] = profile;
              return { labelProfiles: profiles };
            }
            return { labelProfiles: [...state.labelProfiles, profile] };
          }),

        deleteLabelProfile: (id) =>
          set((state) => {
            const profiles = state.labelProfiles.filter((p) => p.id !== id);
            const newActive =
              state.activeLabelProfileId === id
                ? (profiles[0]?.id ?? '')
                : state.activeLabelProfileId;
            return { labelProfiles: profiles, activeLabelProfileId: newActive };
          }),

        upsertPrinterProfile: (profile) =>
          set((state) => {
            const idx = state.printerProfiles.findIndex((p) => p.id === profile.id);
            if (idx >= 0) {
              const profiles = [...state.printerProfiles];
              profiles[idx] = profile;
              return { printerProfiles: profiles };
            }
            return { printerProfiles: [...state.printerProfiles, profile] };
          }),

        deletePrinterProfile: (id) =>
          set((state) => {
            const profiles = state.printerProfiles.filter((p) => p.id !== id);
            const newActive =
              state.activePrinterProfileId === id
                ? (profiles[0]?.id ?? '')
                : state.activePrinterProfileId;
            return { printerProfiles: profiles, activePrinterProfileId: newActive };
          }),

        getActiveLabelProfile: () => {
          const state = get();
          return state.labelProfiles.find((p) => p.id === state.activeLabelProfileId);
        },

        getActivePrinterProfile: () => {
          const state = get();
          return state.printerProfiles.find((p) => p.id === state.activePrinterProfileId);
        },

        exportSettings: () => {
          const state = get();
          return {
            version: 1 as const,
            spoolmanUrl: state.spoolmanUrl,
            labelProfiles: state.labelProfiles,
            printerProfiles: state.printerProfiles,
            activeLabelProfileId: state.activeLabelProfileId,
            activePrinterProfileId: state.activePrinterProfileId,
            theme: state.theme,
          };
        },

        importSettings: (data) =>
          set({
            spoolmanUrl: data.spoolmanUrl,
            labelProfiles: data.labelProfiles,
            printerProfiles: data.printerProfiles,
            activeLabelProfileId: data.activeLabelProfileId,
            activePrinterProfileId: data.activePrinterProfileId,
            theme: data.theme,
          }),
      };
    },
    {
      name: 'spoolprint-settings',
    }
  )
);
