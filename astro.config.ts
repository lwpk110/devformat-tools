import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

import { resolveSiteUrl } from './src/config/site';

export default defineConfig({
  // 生产域名由统一配置提供，预览与其他部署可用 SITE_URL 覆盖。
  site: resolveSiteUrl(process.env.SITE_URL),
  // 子路径与域名分离，避免 canonical 和 sitemap 重复拼接路径。
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  integrations: [react(), tailwind({ applyBaseStyles: false }), sitemap()],
});
