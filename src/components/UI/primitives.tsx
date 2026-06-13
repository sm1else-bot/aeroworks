import type { ReactNode } from 'react';

export function Panel({ title, children, className = '' }: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`pointer-events-auto rounded-none border border-divider bg-panel ${className}`}>
      {title && (
        <div className="border-b border-divider px-2.5 py-1.5">
          <h2 className="text-[11px] font-semibold text-ink">{title}</h2>
        </div>
      )}
      <div className="px-2.5 py-2">{children}</div>
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
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="text-[12px] tabular-nums">
          <span className={accent ? 'text-engineering' : 'text-ink'}>
            {format ? format(value) : value}
          </span>
          {unit && <span className="ml-1 text-muted">{unit}</span>}
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
    <div className="flex rounded-none border border-divider bg-panel-raised">
      {options.map((o, i) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 px-1.5 py-1 text-[12px] transition-colors ${i > 0 ? 'border-l border-divider' : ''} ${
            value === o.id
              ? 'bg-engineering text-white'
              : 'text-muted hover:bg-divider hover:text-ink'
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
      <span className="text-[12px] text-muted">{label}</span>
      <span
        className={`flex h-4 w-8 items-center rounded-none border border-divider transition-colors ${
          value ? 'bg-engineering' : 'bg-track'
        }`}
      >
        <span
          className={`h-3 w-3 bg-ink transition-all ${value ? 'ml-4' : 'ml-0.5'}`}
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
    default: 'text-ink',
    cyan: 'text-engineering',
    amber: 'text-ink',
    green: 'text-ink',
    red: 'text-ink',
  } as const;
  return (
    <div className="rounded-none border border-divider bg-panel-raised px-2 py-1">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`text-sm font-semibold tabular-nums leading-tight ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-muted">{unit}</span>}
      </div>
    </div>
  );
}
