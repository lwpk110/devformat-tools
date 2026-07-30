import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { GET } from '../../src/pages/robots.txt';

describe('Astro SEO 源契约', () => {
  it('robots.txt 允许抓取并声明绝对 sitemap index', async () => {
    const response = await GET({} as never);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe(
      'User-agent: *\nAllow: /\nSitemap: https://devformat.tools/sitemap-index.xml\n',
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
    // 监控与验证 token 通过环境变量注入，未配置时不渲染
    expect(source).toContain('PUBLIC_GOOGLE_SITE_VERIFICATION');
    expect(source).toContain('PUBLIC_CF_ANALYTICS_TOKEN');
    expect(source).toContain('google-site-verification');
    expect(source).toContain('cloudflareinsights.com/beacon.min.js');
  });

  it('转换页输出 FAQPage 结构化数据覆盖全部 FAQ', () => {
    const source = readFileSync('src/pages/convert/[slug].astro', 'utf8');
    expect(source).toContain("'@type': 'FAQPage'");
    expect(source).toContain("'@type': 'Question'");
    expect(source).toContain('converter.faq.map');
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

  it('首页先展示 SEO 排序的 Popular，再提供分类 All tools', () => {
    const source = readFileSync('src/pages/index.astro', 'utf8');
    expect(source.indexOf('Popular conversions')).toBeGreaterThan(0);
    expect(source.indexOf('All tools')).toBeGreaterThan(source.indexOf('Popular conversions'));
    expect(source).toContain('featuredRank');
    expect(source).toContain('allCategories');
    expect(source).toContain('convert/${converter.slug}/');
  });

  it('旧单向 YAML URL 只配置永久重定向', () => {
    const redirects = readFileSync('public/_redirects', 'utf8');
    expect(redirects).toContain('/convert/json-to-yaml/ /convert/json-yaml/ 301');
  });
});
