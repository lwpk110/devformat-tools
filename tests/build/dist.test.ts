// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import converters from '../../src/data/converters.json';

const dist = join(process.cwd(), 'dist');

// 与 astro.config 的 SITE_URL/BASE_PATH 保持一致，默认面向 Cloudflare 根路径部署
const SITE = process.env.SITE_URL ?? 'https://devformat.tools';
const rawBase = process.env.BASE_PATH ?? '/';
const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

function read(relativePath: string): string {
  return readFileSync(join(dist, relativePath), 'utf8');
}

function extractJsonLd(html: string): Record<string, unknown> {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(match, '页面应包含 JSON-LD script').not.toBeNull();
  return JSON.parse(match?.[1] ?? '{}') as Record<string, unknown>;
}

describe('静态构建产物', () => {
  it('存在静态构建目录', () => {
    expect(existsSync(dist)).toBe(true);
  });

  it('转换 HTML 数量与 converters.json 一致', () => {
    const entries = readdirSync(join(dist, 'convert'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(entries.map(({ name }) => name).sort()).toEqual(converters.map(({ slug }) => slug).sort());
  });

  it.each(converters)('$slug 包含 canonical、OpenGraph、JSON-LD、FAQ 和静态正文', (converter) => {
    const html = read(`convert/${converter.slug}/index.html`);
    const normalizedHtml = html.replaceAll('&#38;', '&').replaceAll('&amp;', '&');
    const canonical = `${SITE}${baseUrl}convert/${converter.slug}/`;

    expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
    expect(normalizedHtml).toContain(`<meta property="og:title" content="${converter.title}">`);
    expect(html).toContain(`<meta property="og:url" content="${canonical}">`);
    expect(html).toContain(converter.faq[0].q);
    for (const direction of converter.directions) {
      expect(html).toContain(`${direction.from} to ${direction.to}`);
      expect(html).toContain(direction.summary);
    }
    expect(html).toContain('Related tools');
    expect(html).toContain('Nothing is uploaded.');
    expect(html).not.toContain('fonts.googleapis.com');

    const jsonLd = extractJsonLd(html);
    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      url: canonical,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    });
  });

  it('首页无需 JavaScript 即包含全部工具链接', () => {
    const html = read('index.html');
    expect(html.indexOf('Popular conversions')).toBeLessThan(html.indexOf('>All tools</h2>'));
    for (const converter of converters) {
      expect(html).toContain(`href="${baseUrl}convert/${converter.slug}/"`);
      expect(html).toContain(converter.directions[0].to);
    }
  });

  it('旧方向 URL 不生成 HTML，只保留永久重定向配置', () => {
    expect(existsSync(join(dist, 'convert/json-to-yaml/index.html'))).toBe(false);
    expect(read('_redirects')).toContain('/convert/json-to-yaml/ /convert/json-yaml/ 301');
  });

  it('robots.txt 指向 sitemap index', () => {
    expect(read('robots.txt')).toBe(
      `User-agent: *\nAllow: /\nSitemap: ${SITE}${baseUrl}sitemap-index.xml\n`,
    );
  });

  it('sitemap index 与 sitemap-0.xml 存在并覆盖全部 slug', () => {
    expect(read('sitemap-index.xml')).toContain(`${SITE}${baseUrl}sitemap-0.xml`);
    const sitemap = read('sitemap-0.xml');
    expect(sitemap).toContain(`<loc>${SITE}${baseUrl}</loc>`);
    for (const converter of converters) {
      expect(sitemap).toContain(`<loc>${SITE}${baseUrl}convert/${converter.slug}/</loc>`);
    }
    expect(sitemap).not.toContain('/convert/json-to-yaml/');
  });
});
