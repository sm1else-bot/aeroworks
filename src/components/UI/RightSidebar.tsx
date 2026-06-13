import { useEffect, useRef } from 'react';
import { useAeroStore } from '../../store';
import type { TelemetryState } from '../../hooks/useAeroTelemetry';
import type { TelemetrySample } from '../../types';

function SectionHead({ label }: { label: string }) {
  return (
    <div className="border-b border-[#444] px-2 py-[5px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#777]">{label}</span>
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
    <div className="flex items-baseline justify-between px-2 py-[2px]">
      <span className="text-[10px] uppercase tracking-wide text-[#777]">{label}</span>
      <span className={`font-mono text-[11px] tabular-nums ${accent ? 'text-engineering' : 'text-[#e2e2e2]'}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-[#666]">{unit}</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-trace waveform                                                 */
/* ------------------------------------------------------------------ */

const TRACES = [
  { key: 'fz', label: 'Fz',  unit: 'kN', color: '#4A7A8A', extract: (s: TelemetrySample) => s.fz / 1000 },
  { key: 'fx', label: 'Fx',  unit: 'kN', color: '#B07070', extract: (s: TelemetrySample) => s.fx / 1000 },
  { key: 'ld', label: 'L/D', unit: '',   color: '#6A9955', extract: (s: TelemetrySample) => s.efficiency },
] as const;

const FONT = '"Segoe UI", Arial, sans-serif';

function MultiWaveform({ history }: { history: TelemetrySample[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = parent.clientWidth || 260;
    const H = parent.clientHeight || 120;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const PAD_L = 28;   // Y axis label area
    const PAD_T = 22;   // legend
    const PAD_R = 6;
    const PAD_B = 14;   // X axis label
    const CW = W - PAD_L - PAD_R;
    const CH = H - PAD_T - PAD_B;

    // Background + chart area
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(PAD_L, PAD_T, CW, CH);

    // Chart border
    ctx.strokeStyle = '#383838';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD_L + 0.5, PAD_T + 0.5, CW - 1, CH - 1);

    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = PAD_T + (CH * i) / 4;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + CW, y); ctx.stroke();
    }

    // Y axis labels
    ctx.font = `8px ${FONT}`;
    ctx.fillStyle = '#4a4a4a';
    ctx.textAlign = 'right';
    ctx.fillText('HI',  PAD_L - 3, PAD_T + 6);
    ctx.fillText('MID', PAD_L - 3, PAD_T + CH / 2 + 3);
    ctx.fillText('LO',  PAD_L - 3, PAD_T + CH);

    // X axis label
    ctx.font = `8px ${FONT}`;
    ctx.fillStyle = '#3a3a3a';
    ctx.textAlign = 'right';
    ctx.fillText('time →', W - PAD_R, H - 3);

    // Traces + legend
    const segW = Math.floor(CW / TRACES.length);
    if (history.length >= 2) {
      for (let ti = 0; ti < TRACES.length; ti++) {
        const trace = TRACES[ti];
        const data = history.map(trace.extract);
        let min = Infinity, max = -Infinity;
        for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
        const span = max - min || Math.abs(max) * 0.2 || 1;
        const lo = min - span * 0.1;
        const hi = max + span * 0.1;

        const toX = (i: number) => PAD_L + (i / (data.length - 1)) * CW;
        const toY = (v: number) => PAD_T + CH - ((v - lo) / (hi - lo)) * CH;

        // Trace line
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(data[0]));
        for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
        ctx.strokeStyle = trace.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Endpoint dot
        ctx.beginPath();
        ctx.arc(toX(data.length - 1), toY(data[data.length - 1]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = trace.color;
        ctx.fill();

        // Legend entry (in PAD_T band above chart)
        const lx = PAD_L + ti * segW + 4;
        ctx.strokeStyle = trace.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, PAD_T - 8); ctx.lineTo(lx + 10, PAD_T - 8); ctx.stroke();

        const liveVal = data[data.length - 1];
        const valStr = Math.abs(liveVal) < 10 ? liveVal.toFixed(2) : liveVal.toFixed(1);
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#888';
        ctx.fillText(trace.label, lx + 13, PAD_T - 4);
        ctx.fillStyle = trace.color;
        ctx.fillText(`${valStr}${trace.unit ? ' ' + trace.unit : ''}`, lx + 13 + 22, PAD_T - 4);
      }
    } else {
      ctx.font = `10px ${FONT}`;
      ctx.fillStyle = '#3a3a3a';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting data…', W / 2, H / 2 + 4);
    }
  }, [history]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}

/* ------------------------------------------------------------------ */
/* Right sidebar                                                        */
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
    <aside className="flex w-[22%] min-w-[260px] shrink-0 flex-col overflow-hidden border-l border-[#444] bg-[#252525]">

      {/* ── Active Aero ── */}
      <div className="shrink-0">
        <SectionHead label="Active Aero" />
        {adjustable.length === 0 ? (
          <p className="px-2 py-1.5 text-[10px] leading-snug text-[#666]">
            No adjustable elements. Reset to procedural car for AoA controls.
          </p>
        ) : (
          <>
            {adjustable.map((p) => {
              const overridden = drsOpen && p.role === 'wing-rear';
              const f = forceById.get(p.id);
              const deg = partAngles[p.id] ?? p.defaultAngleDeg ?? 0;
              const minDeg = p.angleRangeDeg?.[0] ?? -10;
              const maxDeg = p.angleRangeDeg?.[1] ?? 40;
              return (
                <div
                  key={p.id}
                  className={`border-b border-[#3a3a3a] ${overridden ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-center justify-between px-2 pt-[3px]">
                    <span className="truncate text-[10px] uppercase tracking-wide text-[#777]" title={p.name}>
                      {p.name}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1">
                      <input
                        type="number"
                        className="w-12 border border-[#555] bg-[#1a1a1a] px-1 py-0 text-right font-mono text-[11px] text-[#e2e2e2] outline-none focus:border-engineering"
                        value={deg.toFixed(1)}
                        min={minDeg}
                        max={maxDeg}
                        step={0.5}
                        disabled={overridden}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          if (!isNaN(n)) setPartAngle(p.id, n);
                        }}
                      />
                      <span className="text-[#666]">°</span>
                    </span>
                  </div>
                  {/* Slider track */}
                  <div className="px-2 pb-0.5 pt-0.5">
                    <input
                      type="range"
                      className="aero-range"
                      min={minDeg}
                      max={maxDeg}
                      step={0.5}
                      value={deg}
                      disabled={overridden}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n)) setPartAngle(p.id, n);
                      }}
                    />
                  </div>
                  {f && (
                    <div className="flex justify-between px-2 pb-[3px] text-[10px] text-[#555]">
                      <span className="font-mono">Fz {(f.fz / 1000).toFixed(2)} kN</span>
                      <span className="font-mono">CL {f.cl.toFixed(2)}</span>
                      {overridden && <span className="text-engineering">DRS</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {hasRearWing && (
              <button
                onClick={toggleDrs}
                className={`acad-btn w-full py-[5px] text-[11px] font-semibold ${drsOpen ? 'bg-engineering text-white' : ''}`}
                style={drsOpen ? { border: '1px solid #3a5560', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.45)' } : undefined}
              >
                {drsOpen ? 'DRS Open' : 'DRS Closed'}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Aero Telemetry ── */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-[#444]">
        <SectionHead label="Aero Telemetry" />

        <div className="shrink-0">
          <DataRow label="Downforce Fz" value={latest ? kN(latest.fz) : '—'} unit="kN" accent />
          <DataRow label="Drag Fx"       value={latest ? kN(latest.fx) : '—'} unit="kN" />
          <DataRow label="L/D Efficiency" value={latest ? latest.efficiency.toFixed(2) : '—'} />
          <DataRow label="CL"            value={latest ? latest.cl.toFixed(3) : '—'} />
          <DataRow label="CD"            value={latest ? latest.cd.toFixed(3) : '—'} />
          <DataRow label="Az Planform"   value={latest ? latest.planformArea.toFixed(2) : '—'} unit="m²" />
          <DataRow label="Ax Frontal"    value={latest ? latest.frontalArea.toFixed(2) : '—'} unit="m²" />

          {/* Aero balance bar */}
          <div className="border-t border-[#3a3a3a] px-2 py-1.5">
            <div className="mb-1 flex justify-between">
              <span className="text-[10px] uppercase tracking-wide text-[#777]">Aero Balance</span>
              <span className="font-mono text-[11px] tabular-nums">
                <span className="text-engineering">{(balance * 100).toFixed(1)}%</span>
                <span className="text-[#555]"> F / </span>
                <span className="text-[#e2e2e2]">{((1 - balance) * 100).toFixed(1)}%</span>
                <span className="text-[#555]"> R</span>
              </span>
            </div>
            <div className="flex h-1.5 overflow-hidden border border-[#3a3a3a]">
              <div
                className="bg-engineering transition-[width] duration-150"
                style={{ width: `${balance * 100}%` }}
              />
              <div
                className="bg-[#444]/50 transition-[width] duration-150"
                style={{ width: `${(1 - balance) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Live waveform */}
        <div className="min-h-0 flex-1 border-t border-[#3a3a3a]">
          <div className="border-b border-[#3a3a3a] px-2 py-[4px] text-[9px] uppercase tracking-widest text-[#4a4a4a]">
            Live Trace
          </div>
          <div className="h-[calc(100%-22px)]">
            <MultiWaveform history={history} />
          </div>
        </div>
      </div>
    </aside>
  );
}
