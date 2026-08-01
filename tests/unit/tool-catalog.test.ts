import { describe, expect, it } from 'vitest';

import { popularTools, toolCatalog, toolCategories } from '../../src/data/toolCatalog';

describe('统一工具目录', () => {
  it('收录全部标准转换器和 ChatGPT Session Converter', () => {
    expect(toolCatalog).toHaveLength(10);
    expect(toolCatalog).toContainEqual(expect.objectContaining({
      id: 'chatgpt-session-converter',
      name: 'ChatGPT Session Converter',
      href: '/session-converter/',
      category: 'Account & Session',
      categoryRank: 1,
      homepageRank: 1,
      kind: 'session',
    }));
  });

  it('用显式字段稳定排序精选工具和分类', () => {
    expect(popularTools[0].id).toBe('chatgpt-session-converter');
    expect(toolCategories[0]).toEqual(expect.objectContaining({
      name: 'Account & Session',
      rank: 1,
      tools: [expect.objectContaining({ id: 'chatgpt-session-converter' })],
    }));
  });
});
