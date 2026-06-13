import { useEffect, useRef } from 'react';
import { useAeroStore } from '../../store';
import type { TelemetryState } from '../../hooks/useAeroTelemetry';
import type { TelemetrySample } from '../../types';

/* ------------------------------------------------------------------ */
/* Micro primitives                                                    */
/* ------------------------------------------------------------------ */

function SectionHead({ label }: { label: string }) {
  return (
    <div className="border-b border-divider px-2 py-1">
      <span className="text-[11px] font-semibold text-ink">{label}</span>
    </div>
  );
}

function DataRow({ label, value, unit, accent }: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-2 py-[3px] text-[11px]">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${accent ? 'text-engineering' : 'text-ink'}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-muted">{unit}</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-trace waveform — all three signals on one canvas              */
/* ------------------------------------------------------------------ */

const TRACES = [
  { key: 'fz', label: 'Fz', color: '#4A6572', extract: (s: TelemetrySample) => s.fz / 1000 },
  { key: 'fx', label: 'Fx', color: '#C47A7A', extract: (s: TelemetrySample) => s.fx / 1000 },
  { key: 'ld', label: 'L/D', color: '#6A9955', extract: (s: TelemetrySample) => s.efficiency },
] as const;

function MultiWaveform({ history }: { history: TelemetrySample[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth || 260;
    const h = parent.clientHeight || 120;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal grid
    ctx.strokeStyle = 'rgba(160,160,160,0.10)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (h * i) / 4); ctx.lineTo(w, (h * i) / 4); ctx.stroke();
    }

    if (history.length >= 2) {
      for (const trace of TRACES) {
        const data = history.map(trace.extract);
        let min = Infinity, max = -Infinity;
        for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
        const span = max - min || Math.abs(max) * 0.2 || 1;
        // Leave 6% headroom top + bottom so traces don't clip the border.
        const lo = min - span * 0.08;
        const hi = max + span * 0.08;
        const toX = (i: number) => (i / (data.length - 1)) * w;
        const toY = (v: number) => h - ((v - lo) / (hi - lo)) * h;

        ctx.beginPath();
        ctx.moveTo(toX(0), toY(data[0]));
        for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
        ctx.strokeStyle = trace.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Live endpoint dot
        const lx = toX(data.length - 1);
        const ly = toY(data[data.length - 1]);
        ctx.beginPath(); ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fillStyle = trace.color; ctx.fill();
      }
    }

    // Inline legend top-left
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    let lx = 5;
    for (const trace of TRACES) {
      ctx.strokeStyle = trace.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, 8); ctx.lineTo(lx + 10, 8); ctx.stroke();
      ctx.fillStyle = '#A0A0A0';
      ctx.fillText(trace.label, lx + 13, 12);
      lx += 42;
    }
  }, [history]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}

/* ------------------------------------------------------------------ */
/* Right sidebar                                                       */
/* ------------------------------------------------------------------ */

export function RightSidebar({ telemetry }: { telemetry: TelemetryState }) {
  const parts = useAeroStore((s) => s.parts);
  const partAngles = useAeroStore((s) => s.partAngles);
  const drsOpen = useAeroStore((s) => s.drsOpen);
  const setPartAngle = useAeroStore((s) => s.setPartAngle);
  const toggleDrs = useAeroStore((s) => s.toggleDrs);
  const { latest, history, partForces } = telemetry;

  const adjustable = parts.filter((p) => p.adjustable);
  const hasRearWing = adjustable.some((p) => p.role === 'wing-rear');
  const forceById = new Map(partForces.map((f) => [f.id, f]));
  const balance = latest?.frontBalance ?? 0.5;
  const kN = (v: number) => (v / 1000).toFixed(2);

  return (
    <aside className="flex w-[22%] min-w-[260px] shrink-0 flex-col overflow-hidden border-l border-divider bg-panel">

      {/* ── Active Aero Properties ── */}
      <div className="shrink-0">
        <SectionHead label="Active Aero Properties" />
        {adjustable.length === 0 ? (
          <p className="px-2 py-1 text-[10px] leading-snug text-muted">
            No adjustable elements. Reset to the procedural car for AoA controls.
          </p>
        ) : (
          <>
            {adjustable.map((p) => {
              const overridden = drsOpen && p.role === 'wing-rear';
              const f = forceById.get(p.id);
              const deg = partAngles[p.id] ?? p.defaultAngleDeg ?? 0;
              return (
                <div
                  key={p.id}
                  className={`border-b border-divider ${overridden ? 'opacity-40' : ''}`}
                >
                  {/* Part name + angle input */}
                  <div className="flex items-center justify-between px-2 py-[3px] text-[11px]">
                    <span className="truncate text-muted" title={p.name}>{p.name}</span>
                    <span className="flex shrink-0 items-baseline gap-1">
                      <input
                        type="number"
                        className="w-12 border border-divider bg-track px-1 py-0 text-right text-[11px] text-ink outline-none focus:border-engineering"
                        value={deg.toFixed(1)}
                        min={p.angleRangeDeg?.[0] ?? -10}
                        max={p.angleRangeDeg?.[1] ?? 40}
                        step={0.5}
                        disabled={overridden}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          if (!isNaN(n)) setPartAngle(p.id, n);
                        }}
                      />
                      <span className="text-muted">°</span>
                    </span>
                  </div>
                  {/* Per-element telemetry sub-row */}
                  {f && (
                    <div className="flex justify-between px-2 pb-[3px] text-[10px] text-muted">
                      <span>Fz {(f.fz / 1000).toFixed(2)} kN</span>
                      <span>CL {f.cl.toFixed(2)}</span>
                      {overridden && <span className="text-engineering">DRS</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {hasRearWing && (
              <button
                onClick={toggleDrs}
                className={`w-full py-1 text-[11px] font-semibold transition-colors ${
                  drsOpen
                    ? 'bg-engineering text-white'
                    : 'bg-panel-raised text-muted hover:text-ink'
                }`}
              >
                {drsOpen ? 'DRS Open' : 'DRS Closed'}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Aero Telemetry Analytics Console ── */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-divider">
        <SectionHead label="Aero Telemetry" />

        {/* Data matrix */}
        <div className="shrink-0">
          <DataRow label="Downforce Fz" value={latest ? kN(latest.fz) : '—'} unit="kN" accent />
          <DataRow label="Drag Fx" value={latest ? kN(latest.fx) : '—'} unit="kN" />
          <DataRow label="L/D Efficiency" value={latest ? latest.efficiency.toFixed(2) : '—'} />
          <DataRow label="CL" value={latest ? latest.cl.toFixed(3) : '—'} />
          <DataRow label="CD" value={latest ? latest.cd.toFixed(3) : '—'} />
          <DataRow label="Az planform" value={latest ? latest.planformArea.toFixed(2) : '—'} unit="m²" />
          <DataRow label="Ax frontal" value={latest ? latest.frontalArea.toFixed(2) : '—'} unit="m²" />

          {/* Aero balance bar */}
          <div className="border-t border-divider px-2 py-1.5">
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-muted">Aero Balance</span>
              <span className="tabular-nums">
                <span className="text-engineering">{(balance * 100).toFixed(1)}%</span>
                <span className="text-muted"> F / </span>
                <span className="text-ink">{((1 - balance) * 100).toFixed(1)}%</span>
                <span className="text-muted"> R</span>
              </span>
            </div>
            <div className="flex h-1.5 overflow-hidden border border-divider">
              <div
                className="bg-engineering transition-[width] duration-150"
                style={{ width: `${balance * 100}%` }}
              />
              <div
                className="bg-muted/35 transition-[width] duration-150"
                style={{ width: `${(1 - balance) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Live waveform — fills the remaining panel height */}
        <div className="min-h-0 flex-1 border-t border-divider">
          <div className="border-b border-divider px-2 py-0.5 text-[10px] text-muted">
            Live trace — Fz / Fx / L:D
          </div>
          <div className="h-[calc(100%-20px)]">
            <MultiWaveform history={history} />
          </div>
        </div>
      </div>
    </aside>
  );
}
