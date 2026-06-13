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
  const tone = fps >= 50 ? 'text-[#e2e2e2]' : fps >= 30 ? 'text-[#a0a0a0]' : 'text-[#c47a7a]';
  return (
    <span className={`text-[12px] font-semibold tabular-nums ${tone}`}>
      {fps}<span className="ml-0.5 text-[10px] font-normal text-[#666]">fps</span>
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
      {/* Electron titlebar — becomes the native drag region when wired up */}
      <div
        className="flex h-7 shrink-0 select-none items-center border-b border-[#242424] bg-[#161616] px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#4a4a4a]">AeroWorks</span>
      </div>

      {/* Menubar */}
      <div className="flex h-9 items-stretch border-b border-[#444] bg-[#2a2a2a]">
        {MENU_ITEMS.map((item) => (
          <button
            key={item}
            className="flex items-center border-r border-[#3a3a3a] px-3 text-[12px] text-[#aaa] hover:bg-[#363636] hover:text-[#e0e0e0] active:bg-[#1e1e1e]"
          >
            {item}
          </button>
        ))}

        <div className="flex items-center gap-1.5 border-r border-[#3a3a3a] px-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="acad-btn flex h-6 items-center px-2.5 text-[11px] font-semibold"
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
            className="acad-btn flex h-6 items-center px-2.5 text-[11px]"
          >
            Reset Car
          </button>
        </div>

        <div className="ml-auto flex items-center gap-4 border-l border-[#3a3a3a] px-3">
          {importError ? (
            <span className="max-w-56 truncate text-[11px] text-[#c47a7a]">{importError}</span>
          ) : (
            <>
              <span className="max-w-56 truncate text-[11px] text-[#666]" title={modelName}>
                {modelName || 'No model loaded'}
              </span>
              <span className="text-[11px] tabular-nums text-[#666]">
                {triCount.toLocaleString()} tris
              </span>
              <span className="text-[11px] tabular-nums text-[#666]">
                {fieldManager.lastBuildMs.toFixed(0)} ms grid
              </span>
            </>
          )}
          <FpsMeter />
        </div>
      </div>

      {importProgress !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#333]">
          <div
            className="h-full bg-engineering transition-[width] duration-100"
            style={{ width: `${importProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[#555] bg-[#1e1e1e]/80">
      <div className="border border-[#555] bg-[#2a2a2a] px-8 py-4 text-[13px] font-semibold text-[#e2e2e2]">
        Drop .stl / .obj to ingest
      </div>
    </div>
  );
}
