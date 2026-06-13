import { useAeroStore } from '../../store';
import type { PartForces } from '../../hooks/useAeroTelemetry';
import { Panel, Slider } from './primitives';

/**
 * Active Aero Controller: per-element angle-of-attack sliders (front flaps,
 * rear DRS flap) plus the DRS toggle. Changing an angle re-bakes the flow
 * field and re-integrates the telemetry breakdown.
 */
export function AeroPanel({ partForces }: { partForces: PartForces[] }) {
  const parts = useAeroStore((s) => s.parts);
  const partAngles = useAeroStore((s) => s.partAngles);
  const drsOpen = useAeroStore((s) => s.drsOpen);
  const setPartAngle = useAeroStore((s) => s.setPartAngle);
  const toggleDrs = useAeroStore((s) => s.toggleDrs);

  const adjustable = parts.filter((p) => p.adjustable);
  const hasRearWing = adjustable.some((p) => p.role === 'wing-rear');
  const forceById = new Map(partForces.map((f) => [f.id, f]));

  return (
    <Panel title="Active Aero" className="w-64">
      {adjustable.length === 0 ? (
        <p className="py-1 text-[10.5px] leading-snug text-slate-500">
          Imported models load as a single rigid body — no articulated
          elements. Reset to the procedural car for active-aero controls.
        </p>
      ) : (
        <>
          {adjustable.map((p) => {
            const overridden = drsOpen && p.role === 'wing-rear';
            const f = forceById.get(p.id);
            return (
              <div key={p.id} className={overridden ? 'opacity-45' : ''}>
                <Slider
                  label={p.name}
                  value={partAngles[p.id] ?? p.defaultAngleDeg ?? 0}
                  min={p.angleRangeDeg?.[0] ?? -10}
                  max={p.angleRangeDeg?.[1] ?? 40}
                  step={0.5}
                  unit="° α"
                  accent
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => setPartAngle(p.id, v)}
                />
                {f && (
                  <div className="-mt-1 mb-1 flex justify-between font-mono text-[9px] text-slate-600">
                    <span>
                      F<sub>z</sub> {(f.fz / 1000).toFixed(2)} kN
                    </span>
                    <span>
                      C<sub>L</sub> {f.cl.toFixed(2)}
                      {overridden && <span className="ml-1 text-accent-amber">DRS OVERRIDE</span>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {hasRearWing && (
            <button
              onClick={toggleDrs}
              className={`mt-1 w-full rounded-md border py-1.5 font-display text-[12px] font-bold uppercase tracking-[0.2em] transition-all ${
                drsOpen
                  ? 'border-accent-green/70 bg-accent-green/15 text-accent-green shadow-[0_0_12px_rgba(74,222,128,0.25)]'
                  : 'border-carbon-600 bg-carbon-850 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {drsOpen ? '● DRS OPEN' : '○ DRS CLOSED'}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
