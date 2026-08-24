/**
 * Grok / xAI 认证与 Refresh Token 刷新客户端
 * 
 * 支持：
 * 1. 使用已有 refresh_token 向 xAI OIDC/OAuth 端点换取最新的 access_token 与 refresh_token
 * 2. 解析 邮箱----密码 或 邮箱----密码----Token 格式并批量调度刷新
 * 3. 构造标准 OAuth2 / OIDC 请求载荷
 */

export interface GrokAuthCredentials {
  email: string;
  password?: string;
  refreshToken?: string;
}

export interface GrokTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface GrokRefreshResult {
  email: string;
  password?: string;
  oldRefreshToken?: string;
  newRefreshToken?: string;
  accessToken?: string;
  success: boolean;
  error?: string;
  statusCode?: number;
}

export const XAI_AUTH_CONFIG = {
  issuer: 'https://auth.x.ai',
  tokenEndpoint: 'https://auth.x.ai/oauth2/token',
  clientId: 'grok-web',
  scope: 'openid profile email offline_access',
};

/**
 * 构造 OAuth2 Refresh Token 刷新请求参数
 */
export function buildRefreshTokenPayload(
  refreshToken: string,
  clientId: string = XAI_AUTH_CONFIG.clientId,
) {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken.trim(),
    client_id: clientId,
  });
}

/**
 * 构造基于账号密码的 SSO 登录 / Token 请求参数
 */
export function buildPasswordAuthPayload(
  credentials: GrokAuthCredentials,
  clientId: string = XAI_AUTH_CONFIG.clientId,
) {
  const params: Record<string, string> = {
    grant_type: 'password',
    username: credentials.email.trim(),
    client_id: clientId,
  };
  if (credentials.password) {
    params.password = credentials.password;
  }
  return new URLSearchParams(params);
}

/**
 * 刷新单个 Grok Refresh Token
 */
export async function refreshGrokToken(
  refreshToken: string,
  fetchFn: typeof fetch = fetch,
  customEndpoint?: string,
): Promise<GrokTokenResponse> {
  const endpoint = customEndpoint || XAI_AUTH_CONFIG.tokenEndpoint;
  const payload = buildRefreshTokenPayload(refreshToken);

  const res = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
    body: payload.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as GrokTokenResponse;

  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || `Token 刷新失败 (HTTP ${res.status})`,
    );
  }

  return data;
}

/**
 * 从多行文本（支持 卡密 1: 邮箱----密码 或 邮箱----密码----Token）中批量提取待处理账号
 */
export function parseAccountsForAuth(text: string): GrokAuthCredentials[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: GrokAuthCredentials[] = [];

  for (const line of lines) {
    let clean = line;
    const colonIdx = clean.indexOf(': ');
    if (colonIdx !== -1 && colonIdx < 15) {
      clean = clean.slice(colonIdx + 2).trim();
    }

    const parts = clean.split('----');
    if (parts.length >= 3) {
      results.push({
        email: parts[0].trim(),
        password: parts[1].trim(),
        refreshToken: parts[2].trim(),
      });
    } else if (parts.length === 2) {
      // 邮箱----密码 或 邮箱----Token
      const first = parts[0].trim();
      const second = parts[1].trim();
      if (second.length > 40 && !second.includes(' ') && !second.includes('@')) {
        results.push({
          email: first,
          refreshToken: second,
        });
      } else {
        results.push({
          email: first,
          password: second,
        });
      }
    } else if (parts.length === 1 && clean.includes('@')) {
      results.push({
        email: clean,
      });
    }
  }

  return results;
}
