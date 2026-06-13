import { useEffect } from 'react';
import { TunnelScene } from './components/WindTunnel/TunnelScene';
import { ControlDock } from './components/UI/ControlDock';
import { AeroPanel } from './components/UI/AeroPanel';
import { Dashboard } from './components/UI/Dashboard';
import { FileDropOverlay, TopBar } from './components/UI/TopBar';
import { useAeroTelemetry } from './hooks/useAeroTelemetry';
import { useAeroStore } from './store';
import { useFieldSync } from './utils/fieldManager';
import { resetToDefaultCar } from './utils/importModel';

export default function App() {
  const hasModel = useAeroStore((s) => s.parts.length > 0);
  useFieldSync();
  const telemetry = useAeroTelemetry();

  // Boot with the procedural multi-element car so the workspace is live
  // immediately.
  useEffect(() => {
    if (!useAeroStore.getState().parts.length) resetToDefaultCar();
  }, []);

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-carbon-950">
      <div className="absolute inset-0">{hasModel && <TunnelScene />}</div>

      {/* HUD overlay — panels re-enable pointer events individually */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-2.5">
        <TopBar />
        <div className="mt-2 flex min-h-0 flex-1 items-start justify-between gap-2">
          <div className="max-h-full overflow-y-auto pr-1 hud-scroll">
            <ControlDock />
          </div>
          <div className="flex max-h-full flex-col items-end gap-2 overflow-y-auto pl-1 hud-scroll">
            <AeroPanel partForces={telemetry.partForces} />
            <Dashboard telemetry={telemetry} />
          </div>
        </div>
      </div>

      <FileDropOverlay />
    </div>
  );
}
