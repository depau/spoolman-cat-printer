import QRCode from 'qrcode';

export interface QRDimensions {
  widthPx: number;
  heightPx: number;
  modules: number;
}

/**
 * Render a QR code onto a canvas at an integer scale factor.
 * Returns the canvas and dimension info.
 */
export async function renderQrToCanvas(
  content: string,
  scaleFactor: number
): Promise<{ canvas: HTMLCanvasElement; dimensions: QRDimensions }> {
  const canvas = document.createElement('canvas');

  await QRCode.toCanvas(canvas, content, {
    errorCorrectionLevel: 'M',
    scale: scaleFactor,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const modules = Math.round(canvas.width / scaleFactor);

  return {
    canvas,
    dimensions: {
      widthPx: canvas.width,
      heightPx: canvas.height,
      modules,
    },
  };
}
