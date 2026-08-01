import { describe, expect, it } from 'vitest';

import converters from '../../src/data/converters.json';
import { convert, supportedConverters } from '../../src/lib/converters';
import { jsonToGo } from '../../src/lib/converters/jsonToGo';
import { jsonToPython } from '../../src/lib/converters/jsonToPython';
import { jsonToRust } from '../../src/lib/converters/jsonToRust';
import { jsonToTypeScript } from '../../src/lib/converters/jsonToTs';
import { jsonToYaml } from '../../src/lib/converters/jsonToYaml';
import { ConversionError } from '../../src/lib/converters/utils';

describe('转换器示例契约', () => {
  it.each(converters.flatMap((converter) => converter.directions))('$id 生成数据源中的确定性示例输出', (direction) => {
    expect(convert(direction.id, direction.sampleInput)).toBe(direction.sampleOutput);
  });

  it('注册全部且仅注册已发布的 direction id', () => {
    const ids = converters.flatMap(({ directions }) => directions.map(({ id }) => id));
    expect(Object.keys(supportedConverters)).toEqual(ids);
  });

  it('拒绝未知 slug', () => {
    expect(() => convert('json-to-unknown', '{}')).toThrowError(
      new ConversionError('不支持的转换器: json-to-unknown'),
    );
  });
});

describe('高频双向转换', () => {
  it('JSON 与 CSV 正确处理逗号、引号和换行', () => {
    const json = '[{"name":"Ada, Lovelace","quote":"say \\"hi\\"","note":"line1\\nline2"}]';
    const csv = convert('json-to-csv', json);
    expect(csv).toBe('name,quote,note\n"Ada, Lovelace","say ""hi""","line1\nline2"');
    expect(JSON.parse(convert('csv-to-json', csv))).toEqual(JSON.parse(json));
  });

  it('Base64 对 UTF-8 文本可逆并拒绝非法输入', () => {
    expect(convert('base64-encode', '你好, DevFormat!')).toBe('5L2g5aW9LCBEZXZGb3JtYXQh');
    expect(convert('base64-decode', '5L2g5aW9LCBEZXZGb3JtYXQh')).toBe('你好, DevFormat!');
    expect(() => convert('base64-decode', '%%%')).toThrow(ConversionError);
  });

  it('Base64 对跨 chunk 的 Unicode 文本保持可逆', () => {
    const input = '开发者🚀'.repeat(8192);
    const encoded = convert('base64-encode', input);

    expect(convert('base64-decode', encoded)).toBe(input);
  });

  it('URL component 编码保留加号语义并支持 Unicode', () => {
    const input = 'Hello World + / 你好🚀';
    const encoded = 'Hello%20World%20%2B%20%2F%20%E4%BD%A0%E5%A5%BD%F0%9F%9A%80';

    expect(convert('url-encode', input)).toBe(encoded);
    expect(convert('url-decode', encoded)).toBe(input);
    expect(convert('url-decode', 'a+b')).toBe('a+b');
  });

  it('URL 解码拒绝非法百分号转义', () => {
    expect(() => convert('url-decode', 'value%ZZ')).toThrow(
      new ConversionError('URL 编码格式无效'),
    );
  });

  it('URL 编码拒绝非法 UTF-16 输入', () => {
    expect(() => convert('url-encode', '\uD800')).toThrow(
      new ConversionError('URL 编码格式无效'),
    );
  });

  it('YAML 与 JSON 支持 nested object 和 array', () => {
    const yaml = convert('json-to-yaml', '{"service":"api","ports":[80,443]}');
    expect(yaml).toContain('service: api');
    expect(JSON.parse(convert('yaml-to-json', yaml))).toEqual({ service: 'api', ports: [80, 443] });
  });

  it('XML 与 JSON 映射 attribute、text 和 repeated elements', () => {
    const json = convert('xml-to-json', '<root id="7"><item>A</item><item>B</item></root>');
    expect(JSON.parse(json)).toEqual({ root: { '@id': '7', item: ['A', 'B'] } });
    expect(convert('json-to-xml', json)).toContain('<root id="7">');
    expect(() => convert('xml-to-json', '<!DOCTYPE root [<!ENTITY x "bad">]><root>&x;</root>')).toThrow(ConversionError);
  });

  it('Timestamp 自动识别秒和毫秒，DateTime 返回 Unix seconds', () => {
    expect(convert('timestamp-to-datetime', '0')).toBe('1970-01-01T00:00:00.000Z');
    expect(convert('timestamp-to-datetime', '1704067200000')).toBe('2024-01-01T00:00:00.000Z');
    expect(convert('datetime-to-timestamp', '2024-01-01T00:00:00Z')).toBe('1704067200');
  });
});

const nestedInput = JSON.stringify({
  'user-profile': { first_name: 'Ada', age: 36 },
  tags: ['compiler', 'math'],
  scores: [1, 2.5],
  mixed: [1, 'two'],
  empty: [],
  nothing: null,
});

describe('JSON to TypeScript', () => {
  it('生成 nested interface、合法属性和联合 array', () => {
    const output = jsonToTypeScript(nestedInput);
    expect(output).toContain('export interface Root');
    expect(output).toContain('"user-profile": UserProfile;');
    expect(output).toContain('export interface UserProfile');
    expect(output).toContain('tags: string[];');
    expect(output).toContain('scores: number[];');
    expect(output).toContain('mixed: (number | string)[];');
    expect(output).toContain('empty: unknown[];');
    expect(output).toContain('nothing: null;');
  });
});

describe('JSON to Go Struct', () => {
  it('生成 nested struct、json tag 和 array fallback', () => {
    const output = jsonToGo(nestedInput);
    expect(output).toContain('type Root struct');
    expect(output).toContain('UserProfile UserProfile `json:"user-profile"`');
    expect(output).toContain('type UserProfile struct');
    expect(output).toContain('Tags []string `json:"tags"`');
    expect(output).toContain('Scores []float64 `json:"scores"`');
    expect(output).toContain('Mixed []any `json:"mixed"`');
    expect(output).toContain('Empty []any `json:"empty"`');
  });
});

describe('JSON to YAML', () => {
  it('保留 nested object、array 和需要引号的 scalar', () => {
    const output = jsonToYaml(JSON.stringify({ service: 'api', nested: { enabled: true }, values: [1, 'yes'], nil: null }));
    expect(output).toBe(
      'service: api\nnested:\n  enabled: true\nvalues:\n  - 1\n  - "yes"\nnil: null',
    );
  });
});

describe('JSON to Python Dataclass', () => {
  it('生成 nested dataclass、字段映射和 union array', () => {
    const output = jsonToPython(nestedInput);
    expect(output).toContain('class UserProfile:');
    expect(output).toContain('class Root:');
    expect(output).toContain('user_profile: UserProfile = field(metadata={"json_key": "user-profile"})');
    expect(output).toContain('tags: list[str]');
    expect(output).toContain('mixed: list[int | str]');
    expect(output).toContain('empty: list[Any]');
  });
});

describe('JSON to Rust Struct', () => {
  it('生成 serde nested struct、rename 和 array fallback', () => {
    const output = jsonToRust(nestedInput);
    expect(output).toContain('pub struct Root');
    expect(output).toContain('#[serde(rename = "user-profile")]');
    expect(output).toContain('pub user_profile: UserProfile,');
    expect(output).toContain('pub struct UserProfile');
    expect(output).toContain('pub tags: Vec<String>,');
    expect(output).toContain('pub mixed: Vec<serde_json::Value>,');
    expect(output).toContain('pub empty: Vec<serde_json::Value>,');
  });
});

describe('通用错误与深层输入', () => {
  it.each([jsonToGo, jsonToTypeScript, jsonToYaml, jsonToPython, jsonToRust])(
    '转换器复用统一非法 JSON 错误',
    (converter) => {
      expect(() => converter('{"broken": }')).toThrow(ConversionError);
    },
  );

  it.each([jsonToGo, jsonToTypeScript, jsonToYaml, jsonToPython, jsonToRust])(
    '转换器处理深层 object 而不崩溃',
    (converter) => {
      let value: Record<string, unknown> = { leaf: true };
      for (let depth = 0; depth < 40; depth += 1) value = { child: value };
      expect(converter(JSON.stringify(value))).toContain('leaf');
    },
  );
});
