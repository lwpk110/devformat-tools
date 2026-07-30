import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 默认指向实际生产域名 pages.dev；GitHub Pages 子路径部署通过 SITE_URL/BASE_PATH 注入覆盖
  site: process.env.SITE_URL ?? 'https://devformat-tools.pages.dev',
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  integrations: [react(), tailwind({ applyBaseStyles: false }), sitemap()],
});
