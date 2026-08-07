import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import converters from '../../src/data/converters.json';

describe('converter 数据契约', () => {
  it('提供 10 个字段完整且 slug 唯一的 canonical converter', () => {
    expect(converters).toHaveLength(10);
    expect(new Set(converters.map(({ slug }) => slug)).size).toBe(10);

    for (const converter of converters) {
      expect(converter).toEqual(
        expect.objectContaining({
          slug: expect.stringMatching(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          category: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          directions: expect.any(Array),
        }),
      );
      expect(converter.directions.length).toBeGreaterThan(0);
      for (const direction of converter.directions) {
        expect(direction).toEqual(expect.objectContaining({
          id: expect.any(String),
          from: expect.any(String),
          to: expect.any(String),
          sampleInput: expect.any(String),
          sampleOutput: expect.any(String),
          downloadExtension: expect.any(String),
          summary: expect.any(String),
        }));
      }
      expect(converter.faq.length).toBeGreaterThan(0);
      expect(converter.faq[0]).toEqual({ q: expect.any(String), a: expect.any(String) });
    }
  });

  it('按 SEO 优先级发布五个精选双向工具、一个普通双向工具和四个专业生成器', () => {
    expect(converters.map(({ slug }) => slug)).toEqual([
      'json-csv',
      'base64',
      'url-encode',
      'json-yaml',
      'json-xml',
      'unix-timestamp',
      'json-to-go-struct',
      'json-to-typescript',
      'json-to-python-dataclass',
      'json-to-rust-struct',
    ]);
    const featured = converters.filter(({ featuredRank }) => featuredRank !== undefined);
    expect(featured.map(({ featuredRank }) => featuredRank)).toEqual([1, 2, 3, 4, 5]);
    expect(featured.every(({ directions }) => directions.length === 2)).toBe(true);
    const urlConverter = converters.find(({ slug }) => slug === 'url-encode');
    expect(urlConverter).toEqual(expect.objectContaining({ category: 'Encoding', directions: expect.any(Array) }));
    expect(urlConverter).not.toHaveProperty('featuredRank');
    expect(converters.filter(({ directions }) => directions.length === 1)).toHaveLength(4);
  });

  it.each(converters)('$slug 的 description 长度在 108–165 字符区间', (converter) => {
    expect(converter.description.length).toBeGreaterThanOrEqual(108);
    expect(converter.description.length).toBeLessThanOrEqual(165);
  });

  it('公开文案使用固定方向按钮而不是已移除的 Swap', () => {
    const faqCopy = converters.flatMap(({ faq }) => faq.flatMap(({ q, a }) => [q, a]));
    const homeSource = readFileSync('src/pages/index.astro', 'utf8');

    expect(faqCopy.join('\n')).not.toMatch(/\bSwap\b/i);
    expect(homeSource).not.toMatch(/\bSwap\b/i);
  });

  it('description 长度保持在 108 到 165 字符之间', () => {
    for (const converter of converters) {
      expect(converter.description.length).toBeGreaterThanOrEqual(108);
      expect(converter.description.length).toBeLessThanOrEqual(165);
    }
  });
});
