import type { APIRoute } from 'astro';

import { DEFAULT_SITE_URL } from '../config/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL(DEFAULT_SITE_URL)).toString().replace(/\/$/, '');
  const base = import.meta.env.BASE_URL;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${origin}${base}sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
