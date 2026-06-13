import { useEffect, useSyncExternalStore } from 'react';
import { useAeroStore } from '../store';
import { FlowField, collectWorldTriangles, type WorldGeometry } from './flowField';

/**
 * Owns the live FlowField + world-space triangle soup. Lives outside React
 * so the per-frame simulation loops can read it without re-render churn;
 * consumers that need rebuild notifications (ribbon retrace, telemetry
 * area cache) subscribe to the version counter.
 */
class FieldManager {
  field: FlowField | null = null;
  world: WorldGeometry | null = null;
  version = 0;
  /** Milliseconds spent in the last grid bake (HUD diagnostics). */
  lastBuildMs = 0;
  private listeners = new Set<() => void>();

  rebuild(): void {
    const { parts, partAngles, drsOpen } = useAeroStore.getState();
    if (parts.length === 0) return;
    const t0 = performance.now();
    this.world = collectWorldTriangles(parts, partAngles, drsOpen);
    this.field = FlowField.build(this.world.soup);
    this.lastBuildMs = performance.now() - t0;
    this.version++;
    for (const l of this.listeners) l();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;
}

export const fieldManager = new FieldManager();

/**
 * Mount once. Rebuilds the field when geometry is replaced (immediately)
 * or when an active-aero angle changes (debounced so slider drags don't
 * re-bake the grid on every pixel).
 */
export function useFieldSync(): void {
  useEffect(() => {
    let timer: number | undefined;
    let lastGeometry = -1;

    const run = (state: { geometryVersion: number }) => {
      const geometryChanged = state.geometryVersion !== lastGeometry;
      lastGeometry = state.geometryVersion;
      window.clearTimeout(timer);
      if (geometryChanged) {
        fieldManager.rebuild();
      } else {
        timer = window.setTimeout(() => fieldManager.rebuild(), 220);
      }
    };

    run(useAeroStore.getState());
    const unsub = useAeroStore.subscribe((state, prev) => {
      if (
        state.geometryVersion !== prev.geometryVersion ||
        state.aeroVersion !== prev.aeroVersion
      ) {
        run(state);
      }
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
}

/** Re-render subscriber for components that retrace on field rebuilds. */
export function useFieldVersion(): number {
  return useSyncExternalStore(fieldManager.subscribe, fieldManager.getVersion);
}
