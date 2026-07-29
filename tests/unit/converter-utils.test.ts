import { describe, expect, it } from 'vitest';

import {
  ConversionError,
  parseJsonObject,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from '../../src/lib/converters/utils';

describe('parseJsonObject', () => {
  it('解析 JSON object 并保留字段', () => {
    expect(parseJsonObject('{"name":"Ada","active":true}')).toEqual({ name: 'Ada', active: true });
  });

  it('拒绝空输入', () => {
    expect(() => parseJsonObject('  \n ')).toThrowError(new ConversionError('请输入 JSON'));
  });

  it.each(['null', '42', '"text"', '[1, 2]'])('拒绝非 object 根值：%s', (input) => {
    expect(() => parseJsonObject(input)).toThrow('根值必须是 JSON object');
  });

  it('为多行语法错误提供行列', () => {
    try {
      parseJsonObject('{\n  "name": "Ada",\n  invalid\n}');
      expect.unreachable('应抛出 ConversionError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConversionError);
      expect(error).toMatchObject({ line: 3, column: 3 });
      expect((error as Error).message).toContain('JSON 语法错误');
    }
  });

  it('可以解析极深嵌套 object', () => {
    let value: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 80; depth += 1) value = { child: value };
    expect(parseJsonObject(JSON.stringify(value))).toEqual(value);
  });
});

describe('标识符命名工具', () => {
  it('生成 PascalCase、camelCase 和 snake_case', () => {
    expect(toPascalCase('user-profile ID')).toBe('UserProfileID');
    expect(toCamelCase('user-profile ID')).toBe('userProfileID');
    expect(toSnakeCase('User Profile-ID')).toBe('user_profile_id');
  });

  it('为数字开头或空标识符提供合法前缀', () => {
    expect(toPascalCase('123')).toBe('Field123');
    expect(toCamelCase('!!!')).toBe('field');
    expect(toSnakeCase('123')).toBe('field_123');
  });
});
