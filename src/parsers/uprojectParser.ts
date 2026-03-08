import * as fs from 'fs';
import type { UProjectData, UEProjectModule } from '../types';

/**
 * Parse a .uproject file and return structured data.
 */
export async function parseUProject(filePath: string): Promise<UProjectData> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const json = JSON.parse(content);

  const modules: UEProjectModule[] = (json.Modules ?? []).map((m: Record<string, string>) => ({
    name: m.Name ?? '',
    type: m.Type ?? 'Runtime',
    loadingPhase: m.LoadingPhase ?? 'Default',
  }));

  const plugins: Array<{ name: string; enabled: boolean }> = (json.Plugins ?? []).map(
    (p: Record<string, unknown>) => ({
      name: (p.Name as string) ?? '',
      enabled: (p.Enabled as boolean) ?? true,
    }),
  );

  return {
    fileVersion: json.FileVersion ?? 3,
    engineAssociation: json.EngineAssociation ?? '',
    category: json.Category ?? '',
    description: json.Description ?? '',
    modules,
    plugins,
  };
}
