import { parseJsonObject, toPascalCase, toSnakeCase } from './utils';

const pythonReserved = new Set(['class', 'def', 'from', 'global', 'import', 'in', 'is', 'lambda', 'None', 'True', 'False']);

export function jsonToPython(input: string): string {
  const root = parseJsonObject(input);
  const definitions = new Map<string, string>();
  let needsField = false;

  const typeFor = (value: unknown, suggestedName: string): string => {
    if (value === null) return 'None';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'list[Any]';
      const types = [...new Set(value.map((item, index) => typeFor(item, `${suggestedName}Item${index || ''}`)))];
      return `list[${types.join(' | ')}]`;
    }
    if (typeof value === 'object') {
      const name = toPascalCase(suggestedName);
      renderDataclass(name, value as Record<string, unknown>);
      return name;
    }
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (typeof value === 'boolean') return 'bool';
    return 'str';
  };

  const renderDataclass = (name: string, object: Record<string, unknown>): void => {
    if (definitions.has(name)) return;
    definitions.set(name, '');
    const fields = Object.entries(object).map(([key, value]) => {
      let identifier = toSnakeCase(key);
      if (pythonReserved.has(identifier)) identifier = `${identifier}_`;
      const changed = identifier !== key;
      needsField ||= changed;
      const mapping = changed ? ` = field(metadata={"json_key": ${JSON.stringify(key)}})` : '';
      const nestedName = name === 'Root' ? key : `${name}${toPascalCase(key)}`;
      return `    ${identifier}: ${typeFor(value, nestedName)}${mapping}`;
    });
    definitions.set(name, `@dataclass\nclass ${name}:\n${fields.length ? fields.join('\n') : '    pass'}`);
  };

  renderDataclass('Root', root);
  const body = [...definitions.values()].reverse().join('\n\n');
  const imports = [
    `from dataclasses import dataclass${needsField ? ', field' : ''}`,
    ...(body.includes('Any') ? ['from typing import Any'] : []),
  ];
  return `${imports.join('\n')}\n\n${body}`;
}
