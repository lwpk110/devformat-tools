import { describe, expect, it } from 'vitest';

import { selectRelatedTools } from '../../src/data/relatedTools';
import type { ConverterData } from '../../src/types/converter';

function tool(slug: string, category: string, formats: string[]): ConverterData {
  return {
    slug,
    category,
    title: slug,
    description: slug,
    directions: [{
      id: slug,
      from: formats[0],
      to: formats[1] ?? formats[0],
      sampleInput: '',
      sampleOutput: '',
      downloadExtension: 'txt',
      summary: slug,
    }],
    faq: [],
  };
}

describe('selectRelatedTools', () => {
  it('优先选择同分类工具，再选择共享格式工具', () => {
    const current = tool('json-csv', 'Data', ['JSON', 'CSV']);

    const related = selectRelatedTools(current, [
      tool('yaml-xml', 'Data', ['YAML', 'XML']),
      tool('json-go', 'Type Generators', ['JSON', 'Go']),
      tool('base64', 'Encoding', ['Text', 'Base64']),
    ]);

    expect(related.map(({ slug }) => slug)).toEqual(['yaml-xml', 'json-go', 'base64']);
  });

  it('排除当前工具并按 slug 稳定处理同分候选', () => {
    const current = tool('json-csv', 'Data', ['JSON', 'CSV']);

    const related = selectRelatedTools(current, [
      current,
      tool('zeta', 'Encoding', ['Text', 'Base64']),
      tool('alpha', 'Encoding', ['Text', 'Base64']),
    ]);

    expect(related.map(({ slug }) => slug)).toEqual(['alpha', 'zeta']);
  });

  it('最多返回四个工具', () => {
    const current = tool('json-csv', 'Data', ['JSON', 'CSV']);

    const related = selectRelatedTools(current, [
      tool('one', 'Data', ['One', 'Two']),
      tool('two', 'Data', ['Three', 'Four']),
      tool('three', 'Data', ['Five', 'Six']),
      tool('four', 'Data', ['Seven', 'Eight']),
      tool('five', 'Data', ['Nine', 'Ten']),
    ]);

    expect(related).toHaveLength(4);
  });
});
