import { describe, expect, it } from 'vitest';

import { DEFAULT_SITE_URL, resolveSiteUrl } from '../../src/config/site';

describe('站点配置', () => {
  it('提供新的 Cloudflare 生产域名作为唯一默认值', () => {
    expect(DEFAULT_SITE_URL).toBe('https://abc123456.uk');
    expect(resolveSiteUrl()).toBe('https://abc123456.uk');
  });

  it('允许部署环境覆盖域名并规范化尾部斜杠', () => {
    expect(resolveSiteUrl('https://preview.example.com/')).toBe('https://preview.example.com');
  });

  it('拒绝带路径的 SITE_URL，子路径必须通过 BASE_PATH 配置', () => {
    expect(() => resolveSiteUrl('https://example.com/subpath')).toThrow('SITE_URL 只能包含协议和域名');
  });
});
