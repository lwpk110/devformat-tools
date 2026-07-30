import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 默认面向 Cloudflare 根路径部署；GitHub Pages 等子路径部署通过 SITE_URL/BASE_PATH 注入
  site: process.env.SITE_URL ?? 'https://devformat.tools',
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  integrations: [react(), tailwind({ applyBaseStyles: false }), sitemap()],
});
