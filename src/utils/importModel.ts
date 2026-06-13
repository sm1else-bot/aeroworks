import { useAeroStore } from '../store';
import { parseModelFile, parsedMeshToParts } from './parsers';
import { createDefaultCar } from './defaultCar';

/** Runs the full ingestion pipeline and swaps the workspace model. */
export async function importModelFile(file: File): Promise<void> {
  const store = useAeroStore.getState();
  store.set({ importProgress: 0, importError: null });
  try {
    const parsed = await parseModelFile(file, (p) =>
      useAeroStore.getState().set({ importProgress: p * 0.92 }),
    );
    if (parsed.triangleCount === 0) {
      throw new Error('No triangles found in file.');
    }
    const label = `${file.name} — ${parsed.triangleCount.toLocaleString()} tris (${parsed.sourceFormat}${parsed.normalsGenerated ? ', normals rebuilt' : ''})`;
    useAeroStore.getState().setParts(parsedMeshToParts(parsed, file.name), label);
    useAeroStore.getState().set({ importProgress: null });
  } catch (err) {
    useAeroStore.getState().set({
      importProgress: null,
      importError: err instanceof Error ? err.message : 'Failed to parse file.',
    });
  }
}

/** Restores the procedural multi-element demo car. */
export function resetToDefaultCar(): void {
  useAeroStore.getState().setParts(createDefaultCar(), 'AW-26 Concept (procedural)');
}
