import { parse } from 'yaml';

import { ConversionError } from './utils';

export function yamlToJson(input: string): string {
  if (!input.trim()) throw new ConversionError('请输入 YAML');
  try {
    const value = parse(input) as unknown;
    if (typeof value !== 'object' || value === null) throw new ConversionError('YAML 根值必须是 object 或 array');
    return JSON.stringify(value, null, 2);
  } catch (cause) {
    if (cause instanceof ConversionError) throw cause;
    throw new ConversionError('YAML 语法错误，请检查输入');
  }
}
