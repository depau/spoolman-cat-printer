import React, {useEffect, useRef, useState} from 'react';
import {CheckCircle, Loader2} from 'lucide-react';
import {buildLabelHtmlDoc, renderLabel} from '@/lib/labelRenderer';
import type {LabelProfile, PrinterProfile} from '@/types/profiles';
import type {ISpool} from '@/types/spoolman';

export type LabelPreviewMode = 'html' | 'png';
export type LabelPrintState = 'pending' | 'printing' | 'done';

type RenderResult =
  | { mode: 'html'; doc: string; widthPx: number; heightPx: number | null; landscapeMode: boolean }
  | { mode: 'png'; canvas: HTMLCanvasElement; widthMm: number; heightMm: number | null };

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton({widthMm}: { widthMm: number }) {
  return (
    <div
      className="bg-muted rounded overflow-hidden relative"
      style={{width: `${widthMm}mm`, maxWidth: '100%', aspectRatio: '5/3'}}
    >
      <div className="absolute inset-0 p-2 flex gap-2">
        <div className="w-1/4 h-full bg-muted-foreground/20 animate-pulse rounded-sm flex-shrink-0"/>
        <div className="flex-1 flex flex-col gap-1.5 pt-1">
          <div className="h-2.5 bg-muted-foreground/20 animate-pulse rounded w-4/5"/>
          <div className="h-2 bg-muted-foreground/15 animate-pulse rounded w-2/3"/>
          <div className="h-2 bg-muted-foreground/15 animate-pulse rounded w-3/4"/>
          <div className="h-2 bg-muted-foreground/15 animate-pulse rounded w-1/2"/>
        </div>
      </div>
    </div>
  );
}

interface ScaledIframeProps {
  srcDoc: string;
  widthPx: number;
  heightPx: number | null;
  dpi: number;
  landscape: boolean;
  widthMm: number;
  heightMm: number | null;
  /** Called once when content height is known (unlimited-height labels only). */
  onHeightMeasured?: () => void;
}

/**
 * Renders a label HTML document inside an iframe, scaled to fit the available
 * container width.  The iframe is given its natural printer-DPI pixel dimensions
 * and then CSS `zoom` is applied to map it to physical mm on screen.  Because
 * CSS `zoom` (unlike `transform: scale`) shrinks the layout box, the parent sees
 * the correct mm footprint with no overflow.
 *
 * A ResizeObserver on a probe div (width: 100%) detects when the viewport is
 * narrower than the label and computes a scale-down factor.
 *
 * For unlimited-height labels: LabelPreview keeps the skeleton visible and
 * mounts this component hidden (position: absolute; visibility: hidden) until
 * the first onHeightMeasured callback.  This lets the iframe render and measure
 * its scrollHeight with no flash, then appear at the correct size.  On
 * subsequent srcDoc changes the previous height is retained until the new load
 * fires, so the adjustment is small rather than a 9999px spike.
 */
function ScaledIframe({srcDoc, widthPx, heightPx, dpi, landscape, widthMm, heightMm, onHeightMeasured}: ScaledIframeProps) {
  const probeRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [scale, setScale] = useState(1);

  // undefined = unlimited-height label, not yet measured.
  // Defined = either the fixed heightPx or the last measured scrollHeight.
  // NOT reset on srcDoc changes — we keep the previous height until onLoad
  // delivers a new one, avoiding a 9999px flash on each profile edit.
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    heightPx ?? undefined
  );

  // Sync when the profile toggles between fixed and unlimited height.
  useEffect(() => {
    if (heightPx != null) setContentHeight(heightPx);
    // Unlimited: leave contentHeight alone; onLoad will update it.
  }, [heightPx]);

  useEffect(() => {
    const el = probeRef.current;
    if (!el) return;
    // naturalPx: how wide the iframe would be in CSS px at scale=1
    // (widthMm mm converted to CSS px at 96 dpi)
    const naturalPx = widthMm * 96 / 25.4;
    const obs = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width;
      setScale(available < naturalPx - 0.5 ? available / naturalPx : 1);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [widthMm]);

  const handleLoad = () => {
    if (heightPx != null) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    iframe.contentDocument.fonts.ready.then(() => {
      const root = iframe.contentDocument?.querySelector('.label-root') as HTMLElement | null;
      if (root) {
        setContentHeight(root.scrollHeight);
        onHeightMeasured?.();
      }
    });
  };

  const baseZoom = 96 / dpi;
  const totalZoom = baseZoom * scale;
  const iframeH = contentHeight ?? 9999;

  // CSS px dimensions of the iframe at native (pre-scale) size
  const nativeW = widthPx;
  const nativeH = iframeH;

  // CSS px dimensions after applying totalZoom
  const scaledW = nativeW * totalZoom;
  const scaledH = nativeH * totalZoom;

  // We use transform:scale instead of CSS zoom because zoom is unreliable on
  // iframes in mobile browsers (especially HiDPI Android Chrome). transform:scale
  // does not shrink the layout box, so we explicitly size the wrapper to the
  // post-scale dimensions and use overflow:hidden + a negative margin trick so
  // the un-scaled iframe DOM footprint doesn't push out the container.
  const iframeStyle: React.CSSProperties = {
    display: 'block',
    border: 'none',
    width: `${nativeW}px`,
    height: `${nativeH}px`,
    transformOrigin: 'top left',
    transform: `scale(${totalZoom})`,
    // Negative margin collapses the extra space the un-scaled layout box would
    // occupy beyond the scaled size.
    marginRight: `${scaledW - nativeW}px`,
    marginBottom: `${scaledH - nativeH}px`,
  };

  const iframe = (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — scrolling is deprecated but still the most reliable way
      scrolling="no"
      title="Label preview"
      onLoad={handleLoad}
      style={iframeStyle}
    />
  );

  if (landscape && heightMm != null) {
    // Portrait iframe layout size after scale:
    //   W = widthPx  * totalZoom  ≈ heightMm mm in CSS px
    //   H = iframeH * totalZoom  ≈ widthMm  mm in CSS px
    // Center inside widthMm × heightMm, rotate 90° CW → corners snap to container.
    const W = widthPx * totalZoom;
    const H = iframeH * totalZoom;
    const containerWPx = widthMm * 96 / 25.4;
    const containerHPx = heightMm * 96 / 25.4;
    const left = (containerWPx - W) / 2;
    const top = (containerHPx - H) / 2;
    return (
      <div ref={probeRef} style={{width: '100%'}}>
        <div style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            left: left,
            top: top,
            transform: 'rotate(90deg)',
            transformOrigin: 'center center',
          }}>
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              sandbox="allow-same-origin"
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              scrolling="no"
              title="Label preview"
              onLoad={handleLoad}
              style={{
                display: 'block',
                border: 'none',
                width: `${widthPx}px`,
                height: `${iframeH}px`,
                transformOrigin: 'top left',
                transform: `scale(${baseZoom})`,
                marginRight: `${widthPx * baseZoom - widthPx}px`,
                marginBottom: `${iframeH * baseZoom - iframeH}px`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={probeRef} style={{width: '100%', overflow: 'hidden'}}>
      {iframe}
    </div>
  );
}

interface PngCanvasProps {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number | null;
}

function PngCanvas({canvas, widthMm, heightMm}: PngCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext('2d')!.drawImage(canvas, 0, 0);
  }, [canvas]);
  return (
    <canvas
      ref={ref}
      style={{
        display: 'block',
        width: `${widthMm}mm`,
        maxWidth: '100%',
        height: heightMm != null ? `${heightMm}mm` : 'auto',
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface LabelPreviewProps {
  spool: ISpool;
  labelProfile: LabelProfile;
  printerProfile: PrinterProfile;
  spoolmanHost: string;
  mode: LabelPreviewMode;
  printState?: LabelPrintState;
  /** Debounce before starting a render, default 300ms */
  debounceMs?: number;
}

export function LabelPreview({
                               spool,
                               labelProfile,
                               printerProfile,
                               spoolmanHost,
                               mode,
                               printState = 'pending',
                               debounceMs = 300,
                             }: LabelPreviewProps) {
  const [result, setResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(true);
  // True while an unlimited-height HTML iframe hasn't yet reported its scrollHeight.
  const [htmlHeightPending, setHtmlHeightPending] = useState(false);
  const keyRef = useRef(0);

  const profileStr = JSON.stringify(labelProfile);
  const printerStr = JSON.stringify(printerProfile);

  useEffect(() => {
    const key = ++keyRef.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        if (mode === 'html') {
          const {html, widthPx, heightPx, landscapeMode} = await buildLabelHtmlDoc(
            spool, labelProfile, printerProfile, spoolmanHost
          );
          if (keyRef.current !== key) return;
          setResult({mode: 'html', doc: html, widthPx, heightPx, landscapeMode});
        } else {
          const rendered = await renderLabel(spool, labelProfile, printerProfile, spoolmanHost);
          if (keyRef.current !== key) return;
          setResult({
            mode: 'png',
            canvas: rendered.previewCanvas,
            widthMm: labelProfile.widthMm,
            heightMm: labelProfile.heightMm,
          });
        }
      } catch (e) {
        console.error('LabelPreview render failed:', e);
      } finally {
        if (keyRef.current === key) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, spool.id, profileStr, printerStr, spoolmanHost]);

  // Whenever a new unlimited-height HTML result arrives, mark height as pending.
  // The skeleton stays visible until ScaledIframe calls onHeightMeasured.
  useEffect(() => {
    setHtmlHeightPending(result?.mode === 'html' && result.heightPx == null);
  }, [result]);

  const widthMm = labelProfile.widthMm;

  const opacityCls =
    printState === 'done' ? 'opacity-40' :
      printState === 'printing' ? 'opacity-60' :
        'opacity-100';

  // Show skeleton when: no result yet, OR awaiting height measurement.
  const showSkeleton = (!result && loading) || htmlHeightPending;

  if (showSkeleton && !result) {
    // No result at all — plain skeleton, no iframe needed yet.
    return <Skeleton widthMm={widthMm}/>;
  }

  return (
    // Explicit mm width + max-width: 100% gives a stable, content-independent
    // size so child width:100% probes resolve correctly (e.g. inside flex
    // items-center without causing circular size feedback).
    // overflow: hidden clips any pre-scale-computation flash.
    <div className={`relative transition-opacity ${opacityCls}`}
         style={{width: `${widthMm}mm`, maxWidth: '100%', overflow: 'hidden'}}>

      {/* Skeleton covers the component while height is being measured */}
      {htmlHeightPending && <Skeleton widthMm={widthMm}/>}

      {/* Spinner overlay during re-renders (suppressed when skeleton is showing) */}
      {loading && !htmlHeightPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {result?.mode === 'html' && (
        // When height is pending: absolutely positioned + invisible so the iframe
        // can render and measure scrollHeight without affecting visible layout.
        // When ready: in-flow at the correct measured height — no flash.
        <div style={htmlHeightPending ? {
          position: 'absolute', inset: 0,
          visibility: 'hidden', pointerEvents: 'none',
        } : {}}>
          <ScaledIframe
            srcDoc={result.doc}
            widthPx={result.widthPx}
            heightPx={result.heightPx}
            dpi={printerProfile.dpi}
            landscape={result.landscapeMode}
            widthMm={widthMm}
            heightMm={labelProfile.heightMm}
            onHeightMeasured={() => setHtmlHeightPending(false)}
          />
        </div>
      )}

      {result?.mode === 'png' && (
        <PngCanvas
          canvas={result.canvas}
          widthMm={result.widthMm}
          heightMm={result.heightMm}
        />
      )}

      {printState === 'done' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <CheckCircle className="h-6 w-6 text-green-500 drop-shadow-sm"/>
        </div>
      )}
      {printState === 'printing' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-6 w-6 text-primary animate-spin drop-shadow-sm"/>
        </div>
      )}
    </div>
  );
}

// ── HTML/PNG mode toggle (shared UI widget) ───────────────────────────────────

export function PreviewModeToggle({
                                    mode,
                                    onChange,
                                  }: {
  mode: LabelPreviewMode;
  onChange: (m: LabelPreviewMode) => void;
}) {
  return (
    <div className="inline-flex rounded border border-input overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => onChange('png')}
        className={`px-2 py-0.5 transition-colors ${
          mode === 'png'
            ? 'bg-primary text-primary-foreground'
            : 'bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        PNG
      </button>
      <button
        type="button"
        onClick={() => onChange('html')}
        className={`px-2 py-0.5 border-l border-input transition-colors ${
          mode === 'html'
            ? 'bg-primary text-primary-foreground'
            : 'bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        HTML
      </button>
    </div>
  );
}
