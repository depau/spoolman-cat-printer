import * as htmlToImage from 'html-to-image';
import {parse as marked} from 'marked';
import type {LabelProfile, PrinterProfile, DitheringAlgorithm} from '@/types/profiles';
import type {ISpool} from '@/types/spoolman';
import {buildTemplateContext, renderTemplate} from '@/lib/templateEngine';
import {renderQrToCanvas} from '@/lib/qrGenerator';
import {mmToPx} from '@/lib/utils';

export interface RenderedLabel {
  bitmap: Uint8Array;
  width: number;   // px (always = printableWidthPx)
  height: number;  // px rows
  previewCanvas: HTMLCanvasElement;
}

interface LabelDimensions {
  effectiveWidthPx: number;
  heightPx: number | null;
  contentWidthPx: number;
  contentHeightPx: number | null;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  renderWidthPx: number;   // before rotation
  renderHeightPx: number | null;
  landscapeMode: boolean;
}

function computeDimensions(
  label: LabelProfile,
  printer: PrinterProfile
): LabelDimensions {
  const dpi = printer.dpi;
  const landscapeMode = label.orientation === 'landscape' && label.heightMm !== null;

  const renderWidthMm = landscapeMode ? label.heightMm! : label.widthMm;
  const renderHeightMm = landscapeMode ? label.widthMm : label.heightMm;

  const rawWidthPx = mmToPx(renderWidthMm, dpi);
  const rawHeightPx = renderHeightMm !== null ? mmToPx(renderHeightMm, dpi) : null;

  const effectiveWidthPx = Math.min(rawWidthPx, printer.printableWidthPx);

  const marginTopPx = mmToPx(label.margins.top, dpi);
  const marginRightPx = mmToPx(label.margins.right, dpi);
  const marginBottomPx = mmToPx(label.margins.bottom, dpi);
  const marginLeftPx = mmToPx(label.margins.left, dpi);

  const contentWidthPx = effectiveWidthPx - marginLeftPx - marginRightPx;
  const contentHeightPx =
    rawHeightPx !== null ? rawHeightPx - marginTopPx - marginBottomPx : null;

  return {
    effectiveWidthPx,
    heightPx: rawHeightPx,
    contentWidthPx,
    contentHeightPx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    renderWidthPx: effectiveWidthPx,
    renderHeightPx: rawHeightPx,
    landscapeMode,
  };
}

function valignToCss(v: string) {
  return v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
}

/**
 * Generates the "semantic" label CSS: typography, colours, layout, and
 * component rules — but no sizing constraints (width/height/padding/overflow).
 * Exported so the profile editor can use it as the starting point when the
 * user switches to Advanced CSS mode, keeping both code paths in sync.
 */
export function generateEasyCss(label: LabelProfile, columnGapPx = 4): string {
  const valign = valignToCss(label.easyVerticalAlign ?? 'center');
  const borderPx = label.borderWidthPx ?? 0;
  const borderColor = label.borderColor ?? '#000000';

  return `.label-root {
  font-family: ${label.easyFontFamily};
  font-size: ${label.easyFontSizePx}px;
  line-height: ${label.easyLineHeight};
  text-align: ${label.easyTextAlign};
  color: #000;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: ${valign};
  border: ${borderPx}px solid ${borderColor};
}

p:not(:last-child) {
  padding-bottom: ${label.easyLineHeight / 2}rem;
}

.label-content-wrapper {
  display: flex;
  flex-direction: ${label.layout === 'qr-top-text-bottom' ? 'column' : 'row'};
  align-items: ${valign};
  gap: ${columnGapPx}px;
  width: 100%;
}

.label-qr canvas,
.label-qr img {
  display: block;
  image-rendering: pixelated;
  flex-shrink: 0;
}

.label-text {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

h1 { font-size: ${Math.round(label.easyFontSizePx * 1.3)}px; font-weight: bold; margin-bottom: 2px; }
h2 { font-size: ${Math.round(label.easyFontSizePx * 1.15)}px; font-weight: bold; margin-bottom: 2px; }
h3 { font-size: ${label.easyFontSizePx}px; font-weight: bold; margin-bottom: 2px; }
p { margin-bottom: 2px; }
strong { font-weight: bold; }
em { font-style: italic; }
img, canvas { image-rendering: pixelated; }`;
}

function buildLabelCss(label: LabelProfile, dims: LabelDimensions, columnGapPx: number): string {
  if (label.styleMode === 'advanced' && label.advancedCss) {
    return label.advancedCss;
  }

  // Sizing constraints are kept separate from the semantic CSS so that
  // generateEasyCss can be exported without exposing renderer internals.
  return `* { box-sizing: border-box; margin: 0; padding: 0; }
body, html { margin: 0; padding: 0; }
.label-root {
  width: ${dims.renderWidthPx}px;${dims.renderHeightPx !== null ? `\n  height: ${dims.renderHeightPx}px;` : ''}
  padding: ${dims.marginTopPx}px ${dims.marginRightPx}px ${dims.marginBottomPx}px ${dims.marginLeftPx}px;
  overflow: hidden;
}
${generateEasyCss(label, columnGapPx)}`;
}


function rotateCanvas90CW(source: HTMLCanvasElement): HTMLCanvasElement {
  const dest = document.createElement('canvas');
  dest.width = source.height;
  dest.height = source.width;
  const ctx = dest.getContext('2d')!;
  ctx.translate(dest.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return dest;
}

function applyDithering(
  imageData: ImageData,
  algorithm: DitheringAlgorithm,
  threshold: number
): Uint8Array {
  const {data, width, height} = imageData;
  const pixels = new Float32Array(width * height);

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    pixels[i] = (r * 0.299 + g * 0.587 + b * 0.114);
  }

  // Apply dithering algorithm
  if (algorithm === 'floyd-steinberg') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const old = pixels[idx];
        const newVal = old < 128 ? 0 : 255;
        pixels[idx] = newVal;
        const err = old - newVal;

        if (x + 1 < width) pixels[y * width + (x + 1)] += err * 7 / 16;
        if (x - 1 >= 0 && y + 1 < height) pixels[(y + 1) * width + (x - 1)] += err * 3 / 16;
        if (y + 1 < height) pixels[(y + 1) * width + x] += err * 5 / 16;
        if (x + 1 < width && y + 1 < height) pixels[(y + 1) * width + (x + 1)] += err * 1 / 16;
      }
    }
  } else if (algorithm === 'threshold') {
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = pixels[i] < threshold ? 0 : 255;
    }
  } else if (algorithm === 'bayer') {
    const BAYER4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bayerVal = (BAYER4[y % 4][x % 4] / 16) * 255;
        pixels[y * width + x] = pixels[y * width + x] > bayerVal ? 255 : 0;
      }
    }
  } else if (algorithm === 'dot') {
    const DOT = [
      [0, 128, 64, 192],
      [192, 64, 128, 0],
      [96, 224, 32, 160],
      [160, 32, 224, 96],
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dotVal = DOT[y % 4][x % 4];
        pixels[y * width + x] = pixels[y * width + x] > dotVal ? 255 : 0;
      }
    }
  }

  // Pack to 1-bit LSB-first (matching @opuu/cat-printer rgbaToBits convention)
  const pitch = Math.ceil(width / 8);
  const bitmap = new Uint8Array(height * pitch);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x] < 128) {
        // Black pixel = set bit
        const byteIdx = y * pitch + Math.floor(x / 8);
        const bitPos = x % 8; // LSB first
        bitmap[byteIdx] |= 1 << bitPos;
      }
    }
  }

  return bitmap;
}

export async function buildLabelHtmlDoc(
  spool: ISpool,
  label: LabelProfile,
  printer: PrinterProfile,
  spoolmanHost: string
): Promise<{ html: string; widthPx: number; heightPx: number | null; landscapeMode: boolean }> {
  const dims = computeDimensions(label, printer);
  const columnGapPx = label.columnGapMm !== undefined ? mmToPx(label.columnGapMm, printer.dpi) : 4;
  const css = buildLabelCss(label, dims, columnGapPx);
  const context = buildTemplateContext(spool, spoolmanHost);
  const markdownText = renderTemplate(label.labelTemplate, context);
  const htmlContent = await marked(markdownText, {breaks: true}) as string;

  const valign = valignToCss(label.easyVerticalAlign ?? 'center');
  const borderPx = label.borderWidthPx ?? 0;
  const borderColor = label.borderColor ?? '#000000';

  let bodyHtml: string;

  if (label.layout === 'text-only') {
    bodyHtml = `<div>${htmlContent}</div>`;
  } else {
    const qrContent = renderTemplate(label.qrContentTemplate, context);
    const {canvas: qrCanvas} = await renderQrToCanvas(qrContent, label.qrScaleFactor);
    const qrDataUrl = qrCanvas.toDataURL('image/png');
    const flexDir = label.layout === 'qr-top-text-bottom' ? 'column' : 'row';
    bodyHtml = `
      <div style="display:flex;flex-direction:${flexDir};align-items:${valign};gap:${columnGapPx}px;width:100%;overflow:hidden;">
        <div style="flex-shrink:0;"><img src="${qrDataUrl}" style="display:block;image-rendering:pixelated;" /></div>
        <div style="flex:1;min-width:0;overflow:hidden;">${htmlContent}</div>
      </div>`;
  }

  const containerStyle = [
    `font-family: ${label.easyFontFamily}`,
    `font-size: ${label.easyFontSizePx}px`,
    `line-height: ${label.easyLineHeight}`,
    `text-align: ${label.easyTextAlign}`,
    `color: #000`,
    `background: #fff`,
    `width: ${dims.renderWidthPx}px`,
    dims.renderHeightPx !== null ? `height: ${dims.renderHeightPx}px` : '',
    dims.renderHeightPx !== null ? `max-height: ${dims.renderHeightPx}px` : '',
    dims.renderHeightPx !== null ? `min-height: ${dims.renderHeightPx}px` : '',
    `padding: ${dims.marginTopPx}px ${dims.marginRightPx}px ${dims.marginBottomPx}px ${dims.marginLeftPx}px`,
    `overflow: hidden`,
    `display: flex`,
    `flex-direction: column`,
    `justify-content: ${valign}`,
    `box-sizing: border-box`,
    `border: ${borderPx}px solid ${borderColor}`,
  ].filter(Boolean).join('; ');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { margin: 0; padding: 0; background: #fff; overflow: hidden; }
${css}
</style>
</head>
<body>
<div class="label-root" style="${containerStyle}">
${bodyHtml}
</div>
</body>
</html>`;

  return {html, widthPx: dims.renderWidthPx, heightPx: dims.renderHeightPx, landscapeMode: dims.landscapeMode};
}

export async function renderLabel(
  spool: ISpool,
  labelProfile: LabelProfile,
  printerProfile: PrinterProfile,
  spoolmanHost: string
): Promise<RenderedLabel> {
  const {html, widthPx, heightPx} = await buildLabelHtmlDoc(spool, labelProfile, printerProfile, spoolmanHost);
  const dims = computeDimensions(labelProfile, printerProfile);

  // Render via an off-screen iframe — identical pipeline to the HTML preview
  const iframeH = heightPx ?? 9999;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.tabIndex = -1;
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    left: -${widthPx + 200}px;
    width: ${widthPx}px;
    height:${iframeH}px;
    border:none;
    pointer-events: none;
  `;
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.addEventListener('load', () => resolve(), {once: true});
      iframe.addEventListener('error', () => reject(new Error('iframe load error')), {once: true});
      iframe.srcdoc = html;
    });

    const iDoc = iframe.contentDocument!;
    await iDoc.fonts.ready;

    const root = iDoc.querySelector('.label-root') as HTMLElement;
    const isUnlimited = heightPx === null;
    const captureHeight = isUnlimited ? root.scrollHeight : heightPx;

    if (isUnlimited) {
      iframe.style.height = `${captureHeight}px`;
    }

    const canvas = await htmlToImage.toCanvas(root, {
      backgroundColor: '#ffffff',
      pixelRatio: 1,
      width: widthPx,
      height: captureHeight,
    });

    const finalCanvas = dims.landscapeMode ? rotateCanvas90CW(canvas) : canvas;

    const ctx = finalCanvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
    const bitmap = applyDithering(imageData, labelProfile.dithering, labelProfile.ditheringThreshold);

    return {
      bitmap,
      width: finalCanvas.width,
      height: finalCanvas.height,
      previewCanvas: finalCanvas,
    };
  } finally {
    document.body.removeChild(iframe);
  }
}
