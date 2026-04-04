export type LabelLayout = 'text-only' | 'qr-top-text-bottom' | 'qr-left-text-right';
export type DitheringAlgorithm = 'floyd-steinberg' | 'threshold' | 'bayer' | 'dot';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type StyleMode = 'easy' | 'advanced';
export type Orientation = 'portrait' | 'landscape';
export type VerticalAlign = 'top' | 'center' | 'bottom';
export type QrContentMode = 'spoolman-id' | 'web-url' | 'custom';

export interface LabelMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LabelProfile {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number | null; // null = unlimited
  orientation: Orientation;
  gapMm: number;
  margins: LabelMargins;
  layout: LabelLayout;
  qrContentTemplate: string;
  qrScaleFactor: number; // integer px/module
  labelTemplate: string;
  styleMode: StyleMode;
  easyFontFamily: string;
  easyFontSizePx: number;
  easyLineHeight: number;
  easyTextAlign: TextAlign;
  advancedCss: string;
  dithering: DitheringAlgorithm;
  ditheringThreshold: number; // 0–255
  easyVerticalAlign: VerticalAlign;
  qrContentMode: QrContentMode;
  borderWidthPx: number; // 0 = no border
  borderColor: string;   // CSS color string, e.g. '#000000'
  columnGapMm: number;   // Gap between QR and text columns (mm), default 2
}

export interface PrinterProfile {
  id: string;
  name: string;
  dpi: number;
  printableWidthPx: number;
  printableHeightPx: number | null; // null = unlimited
  defaultSpeed: number;
  defaultEnergy: number;
  bladeOffsetLines: number;
  associatedDeviceNames: string[];
}
