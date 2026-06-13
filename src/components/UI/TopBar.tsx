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
  const tone = fps >= 50 ? 'text-accent-green' : fps >= 30 ? 'text-accent-amber' : 'text-accent-red';
  return (
    <span className={`font-mono text-[11px] font-bold tabular-nums ${tone}`}>
      {fps} <span className="text-[9px] font-normal text-slate-500">FPS</span>
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
    <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-carbon-600/60 bg-carbon-900/85 px-3 py-1.5 shadow-hud backdrop-blur-md">
      <div className="flex items-baseline gap-2">
        <h1 className="font-display text-sm font-bold uppercase tracking-[0.25em] text-slate-100">
          Aero<span className="text-accent-cyan">Works</span>
        </h1>
        <span className="font-display text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          Virtual Wind Tunnel
        </span>
      </div>

      <div className="h-4 w-px bg-carbon-600" />

      <div className="max-w-72 truncate font-mono text-[10.5px] text-slate-400" title={modelName}>
        {modelName || 'no model'}
      </div>
      <div className="font-mono text-[10px] text-slate-600">
        {triCount.toLocaleString()} tris · grid {fieldManager.lastBuildMs.toFixed(0)} ms
      </div>

      <div className="h-4 w-px bg-carbon-600" />

      <button
        onClick={() => fileRef.current?.click()}
        className="rounded border border-accent-cyan/50 bg-accent-cyan/10 px-2.5 py-0.5 font-display text-[10.5px] font-bold uppercase tracking-wider text-accent-cyan transition-colors hover:bg-accent-cyan/25"
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
        className="rounded border border-carbon-600 px-2.5 py-0.5 font-display text-[10.5px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
      >
        Reset Car
      </button>

      <div className="ml-auto flex items-center gap-3">
        {importError && (
          <span className="max-w-64 truncate font-mono text-[10px] text-accent-red" title={importError}>
            ⚠ {importError}
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
      <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-carbon-950/75 backdrop-blur-sm">
        <div className="w-80 rounded-lg border border-carbon-600 bg-carbon-900 p-5 shadow-hud">
          <div className="mb-2 font-display text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
            Parsing geometry…
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-carbon-700">
            <div
              className="h-full bg-accent-cyan transition-[width] duration-100"
              style={{ width: `${importProgress * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-right font-mono text-[10px] text-slate-500">
            {(importProgress * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    );
  }

  if (!dragging) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-accent-cyan/70 bg-accent-cyan/5">
      <div className="rounded-lg bg-carbon-900/90 px-8 py-4 font-display text-lg font-bold uppercase tracking-[0.3em] text-accent-cyan shadow-hud">
        Drop .STL / .OBJ to ingest
      </div>
    </div>
  );
}
