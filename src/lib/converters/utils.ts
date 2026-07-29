export type JsonObject = Record<string, unknown>;

export class ConversionError extends Error {
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.name = 'ConversionError';
    this.line = line;
    this.column = column;
  }
}

function positionToLineColumn(input: string, position: number): { line: number; column: number } {
  const prefix = input.slice(0, Math.max(0, position));
  const lines = prefix.split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function syntaxLocation(input: string, error: Error): { line?: number; column?: number } {
  const explicit = /line\s+(\d+)\s+column\s+(\d+)/i.exec(error.message);
  if (explicit) return { line: Number(explicit[1]), column: Number(explicit[2]) };

  const positioned = /position\s+(\d+)/i.exec(error.message);
  return positioned ? positionToLineColumn(input, Number(positioned[1])) : {};
}

export function parseJsonObject(input: string): JsonObject {
  if (!input.trim()) throw new ConversionError('请输入 JSON');

  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    const { line, column } = syntaxLocation(input, error);
    throw new ConversionError('JSON 语法错误，请检查输入', line, column);
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConversionError('根值必须是 JSON object');
  }
  return value as JsonObject;
}

function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

function titleWord(word: string): string {
  if (['api', 'http', 'https', 'id', 'json', 'url', 'uuid'].includes(word.toLowerCase())) {
    return word.toUpperCase();
  }
  if (/^[A-Z0-9]+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function toPascalCase(value: string): string {
  const identifier = words(value).map(titleWord).join('') || 'Field';
  return /^\d/.test(identifier) ? `Field${identifier}` : identifier;
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  const identifier = pascal === 'Field' ? 'field' : pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return /^\d/.test(identifier) ? `field${identifier}` : identifier;
}

export function toSnakeCase(value: string): string {
  const identifier = words(value).map((word) => word.toLowerCase()).join('_') || 'field';
  return /^\d/.test(identifier) ? `field_${identifier}` : identifier;
}
