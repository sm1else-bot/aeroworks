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
        <p className="py-1 text-[11px] leading-snug text-muted">
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
                  label={`${p.name} (α)`}
                  value={partAngles[p.id] ?? p.defaultAngleDeg ?? 0}
                  min={p.angleRangeDeg?.[0] ?? -10}
                  max={p.angleRangeDeg?.[1] ?? 40}
                  step={0.5}
                  unit="°"
                  accent
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => setPartAngle(p.id, v)}
                />
                {f && (
                  <div className="-mt-1 mb-1.5 flex justify-between text-[10px] text-muted">
                    <span>
                      F<sub>z</sub> {(f.fz / 1000).toFixed(2)} kN
                    </span>
                    <span>
                      C<sub>L</sub> {f.cl.toFixed(2)}
                      {overridden && <span className="ml-1 text-engineering">DRS override</span>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {hasRearWing && (
            <button
              onClick={toggleDrs}
              className={`mt-1 w-full rounded-none border py-1.5 text-[12px] font-semibold transition-colors ${
                drsOpen
                  ? 'border-engineering bg-engineering text-white'
                  : 'border-divider bg-panel-raised text-muted hover:text-ink'
              }`}
            >
              {drsOpen ? 'DRS Open' : 'DRS Closed'}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
