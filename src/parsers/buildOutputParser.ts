import type { ParsedDiagnostic } from '../types';

/** Regex for MSVC compiler errors/warnings */
const MSVC_PATTERN =
  /^(?:\s*\d+>)?([^\s].*?)\((\d+),?(\d+)?(?:,\d+,\d+)?\)\s*:\s+(error|warning|info)\s+(\w{1,2}\d+)\s*:\s*(.*)$/;

/** Regex for UBT errors */
const UBT_PATTERN = /^(.+?)\((\d+),(\d+)\):\s+error:\s+(.+)$/;

/** Regex for linker errors */
const LINKER_PATTERN = /^(?:\s*\d+>)?([\w.]+)\s*:\s+(error|warning)\s+(LNK\d+):\s+(.*)$/;

/**
 * Parse a single line of MSVC compiler output.
 */
export function parseMSVCLine(line: string): ParsedDiagnostic | undefined {
  const match = MSVC_PATTERN.exec(line);
  if (!match) return undefined;

  return {
    file: match[1],
    line: parseInt(match[2], 10),
    column: match[3] ? parseInt(match[3], 10) : 0,
    severity: match[4] as 'error' | 'warning' | 'info',
    code: match[5],
    message: match[6],
  };
}

/**
 * Parse a single line of UBT output.
 */
export function parseUBTLine(line: string): ParsedDiagnostic | undefined {
  const match = UBT_PATTERN.exec(line);
  if (!match) return undefined;

  return {
    file: match[1],
    line: parseInt(match[2], 10),
    column: parseInt(match[3], 10),
    severity: 'error',
    code: 'UBT',
    message: match[4],
  };
}

/**
 * Parse a single line of linker output.
 */
export function parseLinkerLine(line: string): ParsedDiagnostic | undefined {
  const match = LINKER_PATTERN.exec(line);
  if (!match) return undefined;

  return {
    file: match[1],
    line: 0,
    column: 0,
    severity: match[2] as 'error' | 'warning',
    code: match[3],
    message: match[4],
  };
}

/**
 * Try all parsers on a single line and return the first match.
 */
export function parseBuildLine(line: string): ParsedDiagnostic | undefined {
  return parseMSVCLine(line) ?? parseUBTLine(line) ?? parseLinkerLine(line);
}
