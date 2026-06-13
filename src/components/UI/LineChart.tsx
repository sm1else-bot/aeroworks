import { useEffect, useRef } from 'react';

interface Props {
  data: number[];
  color: string;
  label: string;
  unit: string;
  height?: number;
  format?: (v: number) => string;
}

/**
 * Rolling line graph rendered on a 2D canvas — gridlines, auto-scaled
 * range, gradient fill, and a live value readout. Cheap enough to redraw
 * at the 10 Hz telemetry rate.
 */
export function LineChart({ data, color, label, unit, height = 64, format }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Range with padding; degenerate ranges get a synthetic span.
    let min = Infinity, max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) { min = 0; max = 1; }
    const span = max - min || Math.abs(max) * 0.2 || 1;
    min -= span * 0.15;
    max += span * 0.15;

    // Grid.
    ctx.strokeStyle = 'rgba(80,100,130,0.16)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (data.length >= 2) {
      const toX = (i: number) => (i / (data.length - 1)) * w;
      const toY = (v: number) => h - ((v - min) / (max - min)) * h;

      // Gradient fill under the trace.
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `${color}38`);
      grad.addColorStop(1, `${color}05`);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(data[0]));
      for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(data[0]));
      for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i]));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Live marker.
      const lx = toX(data.length - 1);
      const ly = toY(data[data.length - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }, [data, color, height]);

  const latest = data.length > 0 ? data[data.length - 1] : 0;
  const fmt = format ?? ((v: number) => v.toFixed(1));

  return (
    <div className="mb-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {label}
        </span>
        <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color }}>
          {fmt(latest)} <span className="text-[9px] font-normal text-slate-500">{unit}</span>
        </span>
      </div>
      <div className="w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
