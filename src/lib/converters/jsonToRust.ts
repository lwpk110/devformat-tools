import { parseJsonObject, toPascalCase, toSnakeCase } from './utils';

const rustReserved = new Set(['as', 'break', 'const', 'crate', 'else', 'enum', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while']);

export function jsonToRust(input: string): string {
  const root = parseJsonObject(input);
  const definitions = new Map<string, string>();

  const typeFor = (value: unknown, suggestedName: string): string => {
    if (value === null) return 'Option<serde_json::Value>';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Vec<serde_json::Value>';
      const types = [...new Set(value.map((item, index) => typeFor(item, `${suggestedName}Item${index || ''}`)))];
      return types.length === 1 ? `Vec<${types[0]}>` : 'Vec<serde_json::Value>';
    }
    if (typeof value === 'object') {
      const name = toPascalCase(suggestedName);
      renderStruct(name, value as Record<string, unknown>);
      return name;
    }
    if (typeof value === 'number') return Number.isInteger(value) ? 'i64' : 'f64';
    if (typeof value === 'boolean') return 'bool';
    return 'String';
  };

  const renderStruct = (name: string, object: Record<string, unknown>): void => {
    if (definitions.has(name)) return;
    definitions.set(name, '');
    const fields = Object.entries(object).flatMap(([key, value]) => {
      let identifier = toSnakeCase(key);
      if (rustReserved.has(identifier)) identifier = `${identifier}_field`;
      const rename = identifier !== key ? [`    #[serde(rename = ${JSON.stringify(key)})]`] : [];
      const nestedName = name === 'Root' ? key : `${name}${toPascalCase(key)}`;
      return [...rename, `    pub ${identifier}: ${typeFor(value, nestedName)},`];
    });
    definitions.set(
      name,
      `#[derive(Debug, Serialize, Deserialize)]\npub struct ${name} {\n${fields.join('\n')}\n}`,
    );
  };

  renderStruct('Root', root);
  return `use serde::{Deserialize, Serialize};\n\n${[...definitions.values()].join('\n\n')}`;
}
