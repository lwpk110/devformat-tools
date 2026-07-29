import { parseJsonObject, toPascalCase } from './utils';

export function jsonToGo(input: string): string {
  const root = parseJsonObject(input);
  const definitions = new Map<string, string>();

  const typeFor = (value: unknown, suggestedName: string): string => {
    if (value === null) return 'any';
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]any';
      if (value.every((item) => typeof item === 'number')) {
        return value.every(Number.isInteger) ? '[]int' : '[]float64';
      }
      const types = [...new Set(value.map((item, index) => typeFor(item, `${suggestedName}Item${index || ''}`)))];
      return types.length === 1 ? `[]${types[0]}` : '[]any';
    }
    if (typeof value === 'object') {
      const name = toPascalCase(suggestedName);
      renderStruct(name, value as Record<string, unknown>);
      return name;
    }
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float64';
    if (typeof value === 'boolean') return 'bool';
    return 'string';
  };

  const renderStruct = (name: string, object: Record<string, unknown>): void => {
    if (definitions.has(name)) return;
    definitions.set(name, '');
    const fields = Object.entries(object).map(([key, value]) => {
      const nestedName = name === 'Root' ? key : `${name}${toPascalCase(key)}`;
      return `\t${toPascalCase(key)} ${typeFor(value, nestedName)} \`json:${JSON.stringify(key)}\``;
    });
    definitions.set(name, `type ${name} struct {\n${fields.join('\n')}\n}`);
  };

  renderStruct('Root', root);
  return [...definitions.values()].join('\n\n');
}
