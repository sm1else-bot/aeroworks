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
      {fps} <span className="text-[10px] font-normal text-muted">FPS</span>
    </span>
  );
}

export function TopBar() {
  const modelName = useAeroStore((s) => s.modelName);
  const parts = useAeroStore((s) => s.parts);
  const importError = useAeroStore((s) => s.importError);
  const fileRef = useRef<HTMLInputElement>(null);
  useFieldVersion(); // refresh grid-bake stat after rebuilds

  const triCount = parts.reduce((acc, p) => {
    const idx = p.geometry.getIndex();
    return acc + (idx ? idx.count : p.geometry.attributes.position.count) / 3;
  }, 0);

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-none border border-divider bg-panel px-3 py-1.5">
      <div className="flex items-baseline gap-2">
        <h1 className="text-sm font-semibold text-ink">AeroWorks</h1>
        <span className="text-[11px] text-muted">Virtual Wind Tunnel</span>
      </div>

      <div className="h-4 w-px bg-divider" />

      <div className="max-w-72 truncate text-[12px] text-muted" title={modelName}>
        {modelName || 'No model'}
      </div>
      <div className="text-[11px] text-muted">
        {triCount.toLocaleString()} tris · grid {fieldManager.lastBuildMs.toFixed(0)} ms
      </div>

      <div className="h-4 w-px bg-divider" />

      <button
        onClick={() => fileRef.current?.click()}
        className="rounded-none border border-engineering bg-engineering px-2.5 py-1 text-[12px] text-white transition-colors hover:bg-[#0a88dd]"
      >
        Import .stl / .obj
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
        className="rounded-none border border-divider bg-panel-raised px-2.5 py-1 text-[12px] text-muted transition-colors hover:text-ink"
      >
        Reset Car
      </button>

      <div className="ml-auto flex items-center gap-3">
        {importError && (
          <span className="max-w-64 truncate text-[11px] text-[#D16969]" title={importError}>
            {importError}
          </span>
        )}
        <FpsMeter />
      </div>
    </div>
  );
}

/** Full-window drag-and-drop ingestion + parse progress overlay. */
export function FileDropOverlay() {
  const [dragging, setDragging] = useState(false);
  const importProgress = useAeroStore((s) => s.importProgress);

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

  if (importProgress !== null) {
    return (
      <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-viewport/80">
        <div className="w-80 rounded-none border border-divider bg-panel p-5">
          <div className="mb-2 text-[12px] font-semibold text-ink">Parsing geometry…</div>
          <div className="h-2 overflow-hidden rounded-none border border-divider bg-track">
            <div
              className="h-full bg-engineering transition-[width] duration-100"
              style={{ width: `${importProgress * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-right text-[11px] text-muted">
            {(importProgress * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    );
  }

  if (!dragging) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-engineering bg-engineering/5">
      <div className="rounded-none border border-divider bg-panel px-8 py-4 text-base font-semibold text-ink">
        Drop .stl / .obj to ingest
      </div>
    </div>
  );
}
