import type { TelemetryState } from '../../hooks/useAeroTelemetry';
import { LineChart } from './LineChart';
import { Panel, StatChip } from './primitives';

const kN = (v: number) => (v / 1000).toFixed(2);

/**
 * Live telemetry HUD: headline force figures, the front/rear aero balance
 * bar, and rolling graphs of downforce, drag and L/D efficiency.
 */
export function Dashboard({ telemetry }: { telemetry: TelemetryState }) {
  const { latest, history } = telemetry;
  const balance = latest ? latest.frontBalance : 0.5;

  return (
    <Panel title="Aero Telemetry" className="w-72">
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <StatChip label="Downforce Fz" value={latest ? kN(latest.fz) : '—'} unit="kN" tone="cyan" />
        <StatChip label="Drag Fx" value={latest ? kN(latest.fx) : '—'} unit="kN" tone="red" />
        <StatChip
          label="L/D Eff."
          value={latest ? latest.efficiency.toFixed(2) : '—'}
          tone="green"
        />
      </div>

      <div className="mb-2 grid grid-cols-4 gap-1.5">
        <StatChip label="CL" value={latest ? latest.cl.toFixed(2) : '—'} />
        <StatChip label="CD" value={latest ? latest.cd.toFixed(2) : '—'} />
        <StatChip label="Az" value={latest ? latest.planformArea.toFixed(2) : '—'} unit="m²" />
        <StatChip label="Ax" value={latest ? latest.frontalArea.toFixed(2) : '—'} unit="m²" />
      </div>

      {/* Aerodynamic balance bar */}
      <div className="mb-2">
        <div className="mb-0.5 flex justify-between font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          <span>
            Front <span className="font-mono text-accent-cyan">{(balance * 100).toFixed(1)}%</span>
          </span>
          <span>Aero Balance</span>
          <span>
            <span className="font-mono text-accent-amber">{((1 - balance) * 100).toFixed(1)}%</span> Rear
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-carbon-700">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-cyan/80 to-accent-cyan/40 transition-[width] duration-150"
            style={{ width: `${balance * 100}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-accent-amber/80 to-accent-amber/40 transition-[width] duration-150"
            style={{ width: `${(1 - balance) * 100}%` }}
          />
          <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300/40" />
        </div>
      </div>

      <LineChart
        data={history.map((h) => h.fz / 1000)}
        color="#22d3ee"
        label="Downforce"
        unit="kN"
        format={(v) => v.toFixed(2)}
      />
      <LineChart
        data={history.map((h) => h.fx / 1000)}
        color="#f87171"
        label="Drag"
        unit="kN"
        format={(v) => v.toFixed(2)}
      />
      <LineChart
        data={history.map((h) => h.efficiency)}
        color="#4ade80"
        label="Efficiency L/D"
        unit=""
        format={(v) => v.toFixed(2)}
      />
    </Panel>
  );
}
