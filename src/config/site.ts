export const DEFAULT_SITE_URL = 'https://abc123456.uk';

export function resolveSiteUrl(value?: string): string {
  const candidate = value?.trim() || DEFAULT_SITE_URL;
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('SITE_URL 必须是完整的 HTTP(S) URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('SITE_URL 必须使用 HTTP 或 HTTPS 协议');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('SITE_URL 只能包含协议和域名；子路径请使用 BASE_PATH');
  }

  return parsed.origin;
}
