import { useAeroStore } from '../../store';
import { colormapCss } from '../../utils/colormap';
import { Panel, Segmented, Slider, Toggle } from './primitives';

/** Approximate ISA altitude (m) for a given air density. */
function densityToAltitude(rho: number): number {
  return Math.max(0, 44330 * (1 - Math.pow(rho / 1.225, 1 / 4.256)));
}

const LEGEND_LABELS = {
  velocity: ['Stagnant', 'Freestream+', 'Velocity magnitude'],
  pressure: ['Suction (low p)', 'Stagnation (high p)', 'Static pressure Δ'],
  vorticity: ['Laminar', 'Shed vortex', 'Vorticity |∇×v|'],
} as const;

export function ControlDock() {
  const s = useAeroStore();

  return (
    <div className="flex w-60 flex-col gap-2">
      <Panel title="Tunnel Conditions">
        <Slider
          label="Air Velocity"
          value={s.speedKmh}
          min={0} max={360} step={1}
          unit="km/h"
          accent
          format={(v) => v.toFixed(0)}
          onChange={(v) => s.set({ speedKmh: v })}
        />
        <Slider
          label="Air Density (ρ)"
          value={s.airDensity}
          min={0.7} max={1.4} step={0.005}
          unit="kg/m³"
          format={(v) => v.toFixed(3)}
          onChange={(v) => s.set({ airDensity: v })}
        />
        <div className="-mt-1 mb-1 text-right text-[10px] text-muted">
          ≈ {densityToAltitude(s.airDensity).toFixed(0)} m ISA altitude
        </div>
        <Slider
          label="Viscosity / Turbulence"
          value={s.turbulence}
          min={0} max={1} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => s.set({ turbulence: v })}
        />
        <Slider
          label="Surface Slip (ε)"
          value={s.slipEpsilon}
          min={0} max={1} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => s.set({ slipEpsilon: v })}
        />
      </Panel>

      <Panel title="Flow Visualization">
        <div className="mb-2">
          <Segmented
            options={[
              { id: 'field', label: 'Field' },
              { id: 'ribbons', label: 'Ribbons' },
              { id: 'flow', label: 'Flow' },
              { id: 'probe', label: 'Probe' },
            ]}
            value={s.flowMode}
            onChange={(flowMode) => s.set({ flowMode })}
          />
        </div>
        {s.flowMode === 'field' && (
          <>
            <Slider
              label="Particle Density"
              value={s.particleCount}
              min={1000} max={20000} step={500}
              format={(v) => `${(v / 1000).toFixed(1)}k`}
              onChange={(v) => s.set({ particleCount: v })}
            />
            <Slider
              label="Particle Lifetime"
              value={s.particleLifetime}
              min={1} max={12} step={0.5}
              unit="s"
              format={(v) => v.toFixed(1)}
              onChange={(v) => s.set({ particleLifetime: v })}
            />
          </>
        )}
        {s.flowMode === 'probe' && (
          <p className="py-1 text-[11px] leading-snug text-muted">
            Drag the emitter handle with the gizmo to trace airflow around
            specific components — undertray, flap gaps, wake.
          </p>
        )}
        <div className="mb-2 mt-1">
          <div className="mb-1 text-[11px] text-muted">Color Map</div>
          <Segmented
            options={[
              { id: 'velocity', label: 'Vel' },
              { id: 'pressure', label: 'Press' },
              { id: 'vorticity', label: 'Vort' },
            ]}
            value={s.colorMode}
            onChange={(colorMode) => s.set({ colorMode })}
          />
        </div>
        <div className="mt-1">
          <div
            className="h-2 w-full rounded-none border border-divider"
            style={{ background: colormapCss() }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{LEGEND_LABELS[s.colorMode][0]}</span>
            <span>{LEGEND_LABELS[s.colorMode][1]}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-muted">{LEGEND_LABELS[s.colorMode][2]}</div>
        </div>
      </Panel>

      <Panel title="Body Render">
        <Segmented
          options={[
            { id: 'solid', label: 'Solid' },
            { id: 'pressure', label: 'Cp Map' },
            { id: 'wireframe', label: 'Wire' },
            { id: 'xray', label: 'X-Ray' },
          ]}
          value={s.renderMode}
          onChange={(renderMode) => s.set({ renderMode })}
        />
        {s.renderMode === 'xray' && (
          <div className="mt-1">
            <Slider
              label="Ghost Opacity"
              value={s.ghostOpacity}
              min={0.05} max={1} step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => s.set({ ghostOpacity: v })}
            />
          </div>
        )}
        <div className="mt-2 border-t border-divider pt-1.5">
          <Toggle label="Tunnel Shell" value={s.showTunnel} onChange={(v) => s.set({ showTunnel: v })} />
          <Toggle label="Pause Flow" value={s.paused} onChange={(v) => s.set({ paused: v })} />
        </div>
      </Panel>
    </div>
  );
}
