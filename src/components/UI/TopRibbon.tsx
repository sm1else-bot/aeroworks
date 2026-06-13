import { useEffect, useRef, useState } from 'react';
import { useAeroStore } from '../../store';
import { fieldManager, useFieldVersion } from '../../utils/fieldManager';
import { importModelFile, resetToDefaultCar } from '../../utils/importModel';

function FpsMeter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const tone = fps >= 50 ? 'text-ink' : fps >= 30 ? 'text-muted' : 'text-[#D16969]';
  return (
    <span className={`text-[12px] font-semibold tabular-nums ${tone}`}>
      {fps}<span className="ml-0.5 text-[10px] font-normal text-muted">fps</span>
    </span>
  );
}

const MENU_ITEMS = ['File', 'Edit', 'Simulation', 'Display'] as const;

export function TopRibbon() {
  const modelName = useAeroStore((s) => s.modelName);
  const importProgress = useAeroStore((s) => s.importProgress);
  const importError = useAeroStore((s) => s.importError);
  const parts = useAeroStore((s) => s.parts);
  const fileRef = useRef<HTMLInputElement>(null);
  useFieldVersion();

  const triCount = parts.reduce((acc, p) => {
    const idx = p.geometry.getIndex();
    return acc + (idx ? idx.count : p.geometry.attributes.position.count) / 3;
  }, 0);

  return (
    <div className="relative shrink-0">
      <div className="flex h-10 items-stretch border-b border-divider bg-panel">
        {/* Brand */}
        <div className="flex shrink-0 items-center border-r border-divider px-3">
          <span className="text-[13px] font-semibold text-ink">AeroWorks</span>
        </div>

        {/* Flat menu links */}
        {MENU_ITEMS.map((item) => (
          <button
            key={item}
            className="flex items-center border-r border-divider px-3 text-[12px] text-muted hover:bg-panel-raised hover:text-ink"
          >
            {item}
          </button>
        ))}

        {/* Actions */}
        <div className="flex items-center gap-1.5 border-r border-divider px-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-6 items-center bg-engineering px-2.5 text-[11px] font-semibold text-white hover:bg-[#0a88dd]"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".stl,.obj"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importModelFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={resetToDefaultCar}
            className="flex h-6 items-center border border-divider px-2.5 text-[11px] text-muted hover:text-ink"
          >
            Reset Car
          </button>
        </div>

        {/* Model info + FPS — right-aligned */}
        <div className="ml-auto flex items-center gap-4 border-l border-divider px-3">
          {importError ? (
            <span className="max-w-56 truncate text-[11px] text-[#D16969]">{importError}</span>
          ) : (
            <>
              <span className="max-w-56 truncate text-[11px] text-muted" title={modelName}>
                {modelName || 'No model loaded'}
              </span>
              <span className="text-[11px] tabular-nums text-muted">
                {triCount.toLocaleString()} tris
              </span>
              <span className="text-[11px] tabular-nums text-muted">
                {fieldManager.lastBuildMs.toFixed(0)} ms grid
              </span>
            </>
          )}
          <FpsMeter />
        </div>
      </div>

      {/* Import progress — 2px strip below the ribbon */}
      {importProgress !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-track">
          <div
            className="h-full bg-engineering transition-[width] duration-100"
            style={{ width: `${importProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Full-window drop zone — overlaid above everything. */
export function FileDropOverlay() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void importModelFile(f);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  if (!dragging) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-engineering bg-engineering/5">
      <div className="border border-divider bg-panel px-8 py-4 text-[13px] font-semibold text-ink">
        Drop .stl / .obj to ingest
      </div>
    </div>
  );
}
