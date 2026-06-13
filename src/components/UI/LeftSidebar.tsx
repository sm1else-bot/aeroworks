import { type ReactNode, useState } from 'react';
import { useAeroStore } from '../../store';
import { colormapCss } from '../../utils/colormap';
import type { ColorMode, FlowMode, RenderMode } from '../../types';

/* ------------------------------------------------------------------ */
/* Design Feature Tree primitives                                      */
/* ------------------------------------------------------------------ */

/** Collapsible section with a chevron header. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-divider">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left hover:bg-panel-raised"
      >
        <span
          className="text-[9px] text-muted transition-transform"
          style={{ display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▼
        </span>
        <span className="text-[11px] text-muted">{label}</span>
      </button>
      {open && <div className="py-0.5">{children}</div>}
    </div>
  );
}

/**
 * Inline parameter row — label left, editable value right. Clicking the
 * value switches it to a raw number input (Fusion 360 / Blender style).
 */
function ParamRow({ label, value, min, max, step, unit, onChange, format }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = format ? format(value) : String(value);

  return (
    <div className="flex items-center justify-between px-2 py-[3px]">
      <span className="text-[11px] text-muted">{label}</span>
      <div className="flex items-baseline gap-1">
        {editing ? (
          <input
            type="number"
            autoFocus
            className="w-16 border border-engineering bg-track px-1 py-0 text-right text-[11px] text-ink outline-none"
            value={draft}
            step={step}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const n = parseFloat(draft);
              if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            title="Click to edit"
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            className="w-16 text-right text-[11px] tabular-nums text-ink hover:text-engineering"
          >
            {display}
          </button>
        )}
        {unit && <span className="w-8 text-[10px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}

/** Flat zero-gap segmented strip. */
function SegStrip<T extends string>({ options, value, onChange }: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-divider">
      {options.map((o, i) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={[
            'flex-1 py-[3px] text-[11px] transition-colors',
            i > 0 ? 'border-l border-divider' : '',
            value === o.id ? 'bg-engineering text-white' : 'bg-panel-raised text-muted hover:text-ink',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Compact ON/OFF text toggle. */
function ToggleRow({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between px-2 py-[3px] text-left hover:bg-panel-raised"
    >
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`text-[11px] font-semibold ${value ? 'text-engineering' : 'text-muted'}`}>
        {value ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function LeftSidebar() {
  const s = useAeroStore();

  return (
    <aside className="hud-scroll flex w-72 shrink-0 flex-col overflow-y-auto border-r border-divider bg-panel">
      <Section label="Tunnel Conditions">
        <ParamRow
          label="Air Velocity"
          value={s.speedKmh}
          min={0} max={360} step={1}
          unit="km/h"
          format={(v) => v.toFixed(0)}
          onChange={(v) => s.set({ speedKmh: v })}
        />
        <ParamRow
          label="Air Density (ρ)"
          value={s.airDensity}
          min={0.7} max={1.4} step={0.005}
          unit="kg/m³"
          format={(v) => v.toFixed(3)}
          onChange={(v) => s.set({ airDensity: v })}
        />
        <ParamRow
          label="Turbulence"
          value={s.turbulence}
          min={0} max={1} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => s.set({ turbulence: v })}
        />
        <ParamRow
          label="Surface Slip (ε)"
          value={s.slipEpsilon}
          min={0} max={1} step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => s.set({ slipEpsilon: v })}
        />
      </Section>

      <Section label="Flow Visualization">
        <div className="px-2 py-1">
          <SegStrip<FlowMode>
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
            <ParamRow
              label="Particles"
              value={s.particleCount}
              min={1000} max={20000} step={500}
              format={(v) => `${(v / 1000).toFixed(1)}k`}
              onChange={(v) => s.set({ particleCount: v })}
            />
            <ParamRow
              label="Lifetime"
              value={s.particleLifetime}
              min={1} max={12} step={0.5}
              unit="s"
              format={(v) => v.toFixed(1)}
              onChange={(v) => s.set({ particleLifetime: v })}
            />
          </>
        )}
        {s.flowMode === 'probe' && (
          <p className="px-2 py-1 text-[10px] leading-snug text-muted">
            Drag the blue emitter handle in the viewport.
          </p>
        )}
        <div className="px-2 pb-1 pt-0.5">
          <div className="mb-0.5 text-[10px] text-muted">Color Mapping</div>
          <SegStrip<ColorMode>
            options={[
              { id: 'velocity', label: 'Vel' },
              { id: 'pressure', label: 'Press' },
              { id: 'vorticity', label: 'Vort' },
            ]}
            value={s.colorMode}
            onChange={(colorMode) => s.set({ colorMode })}
          />
        </div>
        <div className="px-2 pb-1">
          <div className="h-1.5 w-full border border-divider" style={{ background: colormapCss() }} />
          <div className="mt-0.5 flex justify-between text-[9px] text-muted">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </Section>

      <Section label="Body Render">
        <div className="px-2 py-1">
          <SegStrip<RenderMode>
            options={[
              { id: 'solid', label: 'Solid' },
              { id: 'pressure', label: 'Cp' },
              { id: 'wireframe', label: 'Wire' },
              { id: 'xray', label: 'X-Ray' },
            ]}
            value={s.renderMode}
            onChange={(renderMode) => s.set({ renderMode })}
          />
        </div>
        {s.renderMode === 'xray' && (
          <ParamRow
            label="Ghost Opacity"
            value={s.ghostOpacity}
            min={0.05} max={1} step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(v) => s.set({ ghostOpacity: v })}
          />
        )}
      </Section>

      <Section label="Display">
        <ToggleRow
          label="Tunnel Shell"
          value={s.showTunnel}
          onChange={(v) => s.set({ showTunnel: v })}
        />
        <ToggleRow
          label="Pause Flow"
          value={s.paused}
          onChange={(v) => s.set({ paused: v })}
        />
      </Section>
    </aside>
  );
}
