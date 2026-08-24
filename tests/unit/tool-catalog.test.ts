import { describe, expect, it } from 'vitest';

import { popularTools, toolCatalog, toolCategories } from '../../src/data/toolCatalog';

describe('统一工具目录', () => {
  it('收录全部标准转换器、ChatGPT Session Converter 和 Card Key Converter', () => {
    expect(toolCatalog).toHaveLength(12);
    expect(toolCatalog).toContainEqual(expect.objectContaining({
      id: 'chatgpt-session-converter',
      name: 'ChatGPT Session Converter',
      href: '/session-converter/',
      category: 'Account & Session',
      categoryRank: 1,
      homepageRank: 1,
      kind: 'session',
    }));
    expect(toolCatalog).toContainEqual(expect.objectContaining({
      id: 'cardkey-to-sub2api',
      name: 'Card Key to Sub2API Converter',
      href: '/cardkey-converter/',
      category: 'Account & Session',
      categoryRank: 1,
      homepageRank: 2,
      kind: 'session',
    }));
    expect(toolCatalog).toContainEqual(expect.objectContaining({
      id: 'url-encode',
      name: 'Text ↔ URL encoded',
      href: '/convert/url-encode/',
      category: 'Encoding',
      kind: 'converter',
    }));
    expect(popularTools.map(({ id }) => id)).not.toContain('url-encode');
  });

  it('用显式字段稳定排序精选工具和分类', () => {
    expect(popularTools[0].id).toBe('chatgpt-session-converter');
    expect(popularTools[1].id).toBe('cardkey-to-sub2api');
    expect(toolCategories[0]).toEqual(expect.objectContaining({
      name: 'Account & Session',
      rank: 1,
      tools: expect.arrayContaining([
        expect.objectContaining({ id: 'chatgpt-session-converter' }),
        expect.objectContaining({ id: 'cardkey-to-sub2api' }),
      ]),
    }));
  });
});
