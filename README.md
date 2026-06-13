# AeroWorks — 3D Motorsport Aerodynamics Workspace

A production-grade virtual wind tunnel for motorsport aero study, built with
React + Vite + TypeScript + React Three Fiber. Boots instantly with a
procedural multi-element F1-style chassis; ingest your own `.stl` / `.obj`
geometry by drag-and-drop.

```bash
npm install
npm run dev      # local workspace
npm run build    # type-check + production bundle
```

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/utils/parsers.ts` | Chunked (non-blocking) binary/ASCII STL + OBJ parsing into TypedArrays, vertex welding, area-weighted normal regeneration fallback, AABB/center extraction, auto normalize-scale-center into the tunnel. |
| `src/utils/defaultCar.ts` | Procedural chassis: nose cone, front wing mainplane + two active flaps, floor/diffuser, rear wing + DRS flap + endplates, wheels. NACA-style airfoil extrusions. |
| `src/utils/flowField.ts` | Velocity-field engine. A distance/nearest-normal voxel grid is baked from a triangle spatial hash (closest-point-on-triangle seeding + Gauss-Seidel distance sweeps), giving O(1) per-particle sampling. Surface deflection follows `v' = v − (1+ε)(v·n)n` with configurable slip ε, plus boundary-layer skin drag, wake deficit/recirculation, and turbulence agitation. Vorticity via finite-difference curl. |
| `src/components/WindTunnel/` | R3F scene: 20k-particle GPU point cloud (custom vertex/fragment shader, one draw call), ribbon streamline tracer, draggable smoke probe, car renderer with solid / Cp-overlay / wireframe / x-ray modes. |
| `src/hooks/useAeroTelemetry.ts` | Analytics engine: exact triangle integration of projected areas (`Az`, `Ax`, wetted area, lift centroids), thin-airfoil `CL(α)` with stall, induced + skin-friction drag (`0.074/Re^⅕`), `Fz = ½ρv²Az·CL`, `Fx = ½ρv²Ax·CD`, front/rear balance from load centroids vs. wheelbase. 10 Hz rolling history. |
| `src/components/UI/` | Industrial HUD: tunnel-condition dock, flow/color/render mode switches, active-aero AoA sliders + DRS toggle, live Fz/Fx/L-over-D charts, balance bar, file ingestion overlay. |

## Notes

- Particle colors map a shared 4-stop gradient (blue → green → yellow → red)
  over velocity magnitude, static pressure delta (Bernoulli `Cp`), or
  vorticity — identical CPU and GLSL implementations in `utils/colormap.ts`.
- Changing an active-aero angle re-bakes the flow grid (debounced) and
  re-integrates the telemetry breakdown; the bake time is shown in the top bar.
- The flow solver is a real-time visualization model (potential-flow-style
  deflection + empirical correlations), not CFD — trends are physical,
  absolute numbers are indicative.
