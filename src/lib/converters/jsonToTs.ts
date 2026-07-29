import { parseJsonObject, toPascalCase } from './utils';

function propertyName(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

export function jsonToTypeScript(input: string): string {
  const root = parseJsonObject(input);
  const definitions = new Map<string, string>();

  const typeFor = (value: unknown, suggestedName: string): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';
      const types = [...new Set(value.map((item, index) => typeFor(item, `${suggestedName}Item${index || ''}`)))];
      const itemType = types.join(' | ');
      return types.length > 1 ? `(${itemType})[]` : `${itemType}[]`;
    }
    if (typeof value === 'object') {
      const name = toPascalCase(suggestedName);
      renderInterface(name, value as Record<string, unknown>);
      return name;
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  };

  const renderInterface = (name: string, object: Record<string, unknown>): void => {
    if (definitions.has(name)) return;
    definitions.set(name, '');
    const fields = Object.entries(object).map(([key, value]) => {
      const nestedName = name === 'Root' ? key : `${name}${toPascalCase(key)}`;
      return `  ${propertyName(key)}: ${typeFor(value, nestedName)};`;
    });
    definitions.set(name, `export interface ${name} {\n${fields.join('\n')}\n}`);
  };

  renderInterface('Root', root);
  return [...definitions.values()].join('\n\n');
}
