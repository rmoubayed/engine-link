import * as fs from 'fs';
import * as path from 'path';

/**
 * Boundaries for the YAML block EngineLink owns inside `.clangd`.
 * We replace only this region on updates so user config outside it is preserved.
 */
export const CLANGD_MANAGED_BEGIN = '# <<< enginelink-managed >>>';
export const CLANGD_MANAGED_END = '# <<< end-enginelink-managed >>>';

function managedBlock(): string {
  return [
    CLANGD_MANAGED_BEGIN,
    '# MSVC intrinsics vs Clang builtins when parsing with clangd (IDE-only; real UE builds still use MSVC).',
    'Diagnostics:',
    '  Suppress: builtin_definition',
    CLANGD_MANAGED_END,
  ].join('\n');
}

/**
 * Upsert a `.clangd` file in the UE project root so clangd suppresses false
 * `builtin_definition` diagnostics when MSVC headers define intrinsics Clang also treats as builtins.
 *
 * @returns `true` if the file was created or changed.
 */
export async function ensureClangdConfig(projectRoot: string): Promise<boolean> {
  const filePath = path.join(projectRoot, '.clangd');
  const block = managedBlock();

  let content = '';
  try {
    content = await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    content = '';
  }

  const beginIdx = content.indexOf(CLANGD_MANAGED_BEGIN);
  const endIdx = content.indexOf(CLANGD_MANAGED_END);

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = content.slice(0, beginIdx).replace(/\s+$/, '');
    const afterEnd = endIdx + CLANGD_MANAGED_END.length;
    const after = content.slice(afterEnd).replace(/^\s+/, '');
    const pieces = [before, block];
    if (after.length > 0) {
      pieces.push(after);
    }
    const newContent = pieces.join('\n\n') + '\n';
    if (newContent === content) {
      return false;
    }
    await fs.promises.writeFile(filePath, newContent, 'utf-8');
    return true;
  }

  // No managed block yet: don't duplicate if user already suppresses this diagnostic
  if (/\bbuiltin_definition\b/.test(content)) {
    return false;
  }

  const trimmed = content.trimEnd();
  const newContent = trimmed.length === 0 ? `${block}\n` : `${trimmed}\n\n${block}\n`;
  if (newContent === content) {
    return false;
  }
  await fs.promises.writeFile(filePath, newContent, 'utf-8');
  return true;
}
