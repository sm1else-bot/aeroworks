import type { ReactNode } from 'react';

export function Panel({ title, children, className = '' }: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`pointer-events-auto rounded-lg border border-carbon-600/60 bg-carbon-900/85 shadow-hud backdrop-blur-md ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-carbon-700/70 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan shadow-[0_0_6px_#22d3ee]" />
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {title}
          </h2>
        </div>
      )}
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

export function Slider({ label, value, min, max, step, unit, onChange, format, accent = false }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accent?: boolean;
}) {
  return (
    <label className="block py-1">
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="font-display text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`font-mono text-[11px] tabular-nums ${accent ? 'text-accent-cyan' : 'text-slate-200'}`}>
          {format ? format(value) : value}
          {unit && <span className="ml-0.5 text-slate-500">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="aero-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-carbon-600/70 bg-carbon-850">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 px-1.5 py-1 font-display text-[10.5px] font-semibold uppercase tracking-wider transition-colors ${
            value === o.id
              ? 'bg-accent-cyan/15 text-accent-cyan shadow-[inset_0_-2px_0_#22d3ee]'
              : 'text-slate-500 hover:bg-carbon-700/50 hover:text-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between py-1 text-left"
    >
      <span className="font-display text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span
        className={`relative h-3.5 w-7 rounded-full transition-colors ${
          value ? 'bg-accent-cyan/70' : 'bg-carbon-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${
            value ? 'left-4' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function StatChip({ label, value, unit, tone = 'default' }: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'default' | 'cyan' | 'amber' | 'green' | 'red';
}) {
  const tones = {
    default: 'text-slate-200',
    cyan: 'text-accent-cyan',
    amber: 'text-accent-amber',
    green: 'text-accent-green',
    red: 'text-accent-red',
  } as const;
  return (
    <div className="rounded-md border border-carbon-700/60 bg-carbon-850/80 px-2 py-1">
      <div className="font-display text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </div>
      <div className={`font-mono text-sm font-bold tabular-nums leading-tight ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}
