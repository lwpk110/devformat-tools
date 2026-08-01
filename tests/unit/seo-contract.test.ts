import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { GET } from '../../src/pages/robots.txt';
import { DEFAULT_SITE_URL } from '../../src/config/site';

describe('Astro SEO 源契约', () => {
  it('robots.txt 允许抓取并声明绝对 sitemap index', async () => {
    const response = await GET({} as never);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe(
      `User-agent: *\nAllow: /\nSitemap: ${DEFAULT_SITE_URL}/sitemap-index.xml\n`,
    );
  });

  it('Layout 定义 canonical、OpenGraph 与 SoftwareApplication JSON-LD', () => {
    const source = readFileSync('src/layouts/Layout.astro', 'utf8');
    expect(source).toContain('rel="canonical"');
    expect(source).toContain('property="og:title"');
    expect(source).toContain('property="og:description"');
    expect(source).toContain('property="og:type"');
    expect(source).toContain('property="og:url"');
    expect(source).toContain('application/ld+json');
    expect(source).toContain("'@type': 'SoftwareApplication'");
    // 社交分享卡片 og:image 与 twitter:image 注入
    expect(source).toContain('ogImageUrl');
    expect(source).toContain('property="og:image"');
    expect(source).toContain('summary_large_image');
    // 监控与验证 token 通过环境变量注入，未配置时不渲染
    expect(source).toContain('PUBLIC_GOOGLE_SITE_VERIFICATION');
    expect(source).toContain('liaWDIJgY2L_SkbRBjl-1h1cEvZJR3rb5oGIqE1RJ68');
    expect(source).toContain('PUBLIC_CF_ANALYTICS_TOKEN');
    expect(source).toContain('google-site-verification');
    expect(source).toContain('cloudflareinsights.com/beacon.min.js');
    expect(source).toContain('DEFAULT_SITE_URL');
  });

  it('robots 与面包屑回退到统一站点配置', () => {
    expect(readFileSync('src/pages/robots.txt.ts', 'utf8')).toContain('DEFAULT_SITE_URL');
    expect(readFileSync('src/pages/convert/[slug].astro', 'utf8')).toContain('DEFAULT_SITE_URL');
    expect(readFileSync('src/pages/session-converter.astro', 'utf8')).toContain('DEFAULT_SITE_URL');
  });

  it('转换页输出 FAQPage 结构化数据覆盖全部 FAQ', () => {
    const source = readFileSync('src/pages/convert/[slug].astro', 'utf8');
    expect(source).toContain("'@type': 'FAQPage'");
    expect(source).toContain("'@type': 'Question'");
    expect(source).toContain('converter.faq.map');
    // 正文内容区组件用于消除 thin content
    expect(source).toContain('ContentSection');
  });

  it('转换路由由 converters.json 通过 getStaticPaths 生成', () => {
    const source = readFileSync('src/pages/convert/[slug].astro', 'utf8');
    expect(source).toContain('getStaticPaths');
    expect(source).toContain('(convertersData as ConverterData[]).map');
    expect(source).toContain('client:idle');
    expect(source).toContain('directions={converter.directions}');
    expect(source).toContain('Related tools');
    expect(source).toContain('<FAQSection');
  });

  it('首页从统一工具目录先展示 Popular tools，再提供分类 All tools', () => {
    const source = readFileSync('src/pages/index.astro', 'utf8');
    expect(source.indexOf('Popular tools')).toBeGreaterThan(0);
    expect(source.indexOf('All tools')).toBeGreaterThan(source.indexOf('Popular tools'));
    expect(source).toContain("from '../data/toolCatalog'");
    expect(source).toContain('popularTools');
    expect(source).toContain('toolCategories');
    expect(source).not.toContain('id="session-tools"');
    expect(source).not.toContain('Session & account tools');
  });

  it('旧单向 YAML URL 只配置永久重定向', () => {
    const redirects = readFileSync('public/_redirects', 'utf8');
    expect(redirects).toContain('/convert/json-to-yaml/ /convert/json-yaml/ 301');
  });
});
