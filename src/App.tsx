import { useEffect } from 'react';
import { TunnelScene } from './components/WindTunnel/TunnelScene';
import { FileDropOverlay, TopRibbon } from './components/UI/TopRibbon';
import { LeftSidebar } from './components/UI/LeftSidebar';
import { RightSidebar } from './components/UI/RightSidebar';
import { useAeroTelemetry } from './hooks/useAeroTelemetry';
import { useAeroStore } from './store';
import { useFieldSync } from './utils/fieldManager';
import { resetToDefaultCar } from './utils/importModel';

/**
 * Rigid full-screen docked layout — no floating cards, no gaps, no margins.
 *
 *   ┌─────────────────────────────────────────────────────────┐  h-10
 *   │  App ribbon (menu + actions + model info)               │
 *   ├────────────┬───────────────────────────┬────────────────┤
 *   │  Left      │                           │  Right         │
 *   │  sidebar   │   3-D viewport (Canvas)   │  sidebar       │
 *   │  w-72      │   flex-1                  │  w-[22%]       │
 *   │            │                           │                │
 *   └────────────┴───────────────────────────┴────────────────┘
 *
 * All panes are separated by a 1px border-divider line.
 * Panels are directly docked — no background blur, no shadow, no margin.
 */
export default function App() {
  const hasModel = useAeroStore((s) => s.parts.length > 0);
  useFieldSync();
  const telemetry = useAeroTelemetry();

  useEffect(() => {
    if (!useAeroStore.getState().parts.length) resetToDefaultCar();
  }, []);

  return (
    <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-viewport text-ink">
      <TopRibbon />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {hasModel && <TunnelScene />}
        </main>
        <RightSidebar telemetry={telemetry} />
      </div>
      <FileDropOverlay />
    </div>
  );
}
