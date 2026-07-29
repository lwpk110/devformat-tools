import { parseJsonObject } from './utils';

function yamlString(value: string): string {
  const reserved = /^(?:null|~|true|false|yes|no|on|off|[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)$/i;
  const unsafe = value.length === 0 || value.trim() !== value || reserved.test(value) || /[:#\[\]{},&*!|>'"%@`\n\r]/.test(value);
  return unsafe ? JSON.stringify(value) : value;
}

function scalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return yamlString(value);
  return String(value);
}

function renderArray(values: unknown[], indent: number): string[] {
  const prefix = ' '.repeat(indent);
  if (values.length === 0) return [`${prefix}[]`];
  return values.flatMap((value) => {
    if (Array.isArray(value)) return [`${prefix}-`, ...renderArray(value, indent + 2)];
    if (typeof value === 'object' && value !== null) {
      return [`${prefix}-`, ...renderObject(value as Record<string, unknown>, indent + 2)];
    }
    return [`${prefix}- ${scalar(value)}`];
  });
}

function renderObject(object: Record<string, unknown>, indent: number): string[] {
  const prefix = ' '.repeat(indent);
  if (Object.keys(object).length === 0) return [`${prefix}{}`];
  return Object.entries(object).flatMap(([key, value]) => {
    const renderedKey = yamlString(key);
    if (Array.isArray(value)) {
      if (value.length === 0) return [`${prefix}${renderedKey}: []`];
      return [`${prefix}${renderedKey}:`, ...renderArray(value, indent + 2)];
    }
    if (typeof value === 'object' && value !== null) {
      if (Object.keys(value).length === 0) return [`${prefix}${renderedKey}: {}`];
      return [`${prefix}${renderedKey}:`, ...renderObject(value as Record<string, unknown>, indent + 2)];
    }
    return [`${prefix}${renderedKey}: ${scalar(value)}`];
  });
}

export function jsonToYaml(input: string): string {
  return renderObject(parseJsonObject(input), 0).join('\n');
}
