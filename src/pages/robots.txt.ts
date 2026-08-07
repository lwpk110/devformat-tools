import type { APIRoute } from 'astro';

import { DEFAULT_SITE_URL } from '../config/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  // 构建期从 Astro 配置读取 site 与 base，使 robots 与实际部署域名/子路径保持一致
  const origin = (site ?? new URL(DEFAULT_SITE_URL)).toString().replace(/\/$/, '');
  const base = import.meta.env.BASE_URL;
  const body = `User-agent: *\nAllow: /\nSitemap: ${origin}${base}sitemap.xml\nSitemap: ${origin}${base}sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
