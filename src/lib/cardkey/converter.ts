// 卡密 (Card Key) 转 Sub2API / Token / CPA 转换引擎：纯函数，无 DOM 依赖
// 支持解析 `卡密 1: 邮箱----密码----Token`、`邮箱----密码----Token` 等格式

export type CardKeyPlatform = 'grok' | 'claude' | 'openai' | 'gemini';

export type CardKeyOutputFormat = 'sub2api' | 'tokens' | 'cards' | 'cpa';

export const CARDKEY_PLATFORM_LABELS: Record<CardKeyPlatform, string> = {
  grok: 'Grok (xAI)',
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI / ChatGPT',
  gemini: 'Gemini (Google)',
};

export const CARDKEY_FORMAT_LABELS: Record<CardKeyOutputFormat, string> = {
  sub2api: 'Sub2API JSON',
  tokens: '纯 Token 列表',
  cards: '清洗卡密 (邮箱----密码----Token)',
  cpa: 'CPA / cliProxyAPI JSON',
};

export interface CardKeyRecord {
  index: number;
  email: string;
  password?: string;
  token: string;
  platform: CardKeyPlatform;
  rawLine: string;
  sourceName?: string;
}

export interface CardKeyError {
  lineIndex: number;
  rawLine: string;
  reason: string;
  sourceName?: string;
}

export interface CardKeyConvertOptions {
  platform?: CardKeyPlatform;
  now?: Date;
  sourceName?: string;
}

export interface CardKeyParseResult {
  records: CardKeyRecord[];
  skipped: CardKeyError[];
  tokens: string[];
}

export const EXAMPLE_CARD_KEYS = `卡密 1: tjznoni48159+9kylxo@outlook.com----Jm#xAi9kP$2mR7vL!qW4nE8----OojE0C5AYydFgdN093z0GvcrJwPy-6MynXvMClJXm_0UJDtUEUSq8QE2UQw6z8Vyj7twhuRAeI8J298JjDKh9g

卡密 2: hrizgqf05998+9kyyyq@outlook.com----Jm#xAi9kP$2mR7vL!qW4nE8----4O_hDxNvrgS1l_Ca2m25vakLdeDPYhtBPAU_R0jy94i58z_H1yiB2mqvCzmGnw-SQ35jAbj8UBFWcjeMDZivQw

卡密 3: kptxvcq32660+9kzipr@outlook.com----Jm#xAi9kP$2mR7vL!qW4nE8----2XqHBPLHqpO58DelH9hUN8zj5Xa3mvAPnJrtOGiuS66dzJ-2ZHT8irz7E7vcuE2RX_R__1-TT1QfVQqMZbls4Q`;

/**
 * 解析单行卡密文本
 */
export function parseCardKeyLine(
  line: string,
  index: number,
  options: CardKeyConvertOptions = {},
): CardKeyRecord | CardKeyError {
  const platform = options.platform ?? 'grok';
  const sourceName = options.sourceName ?? 'pasted-text';
  let clean = line.trim();

  if (!clean) {
    return { lineIndex: index, rawLine: line, reason: '空行', sourceName };
  }

  // 去除可能的前缀，例如 "卡密 1: "、"卡密1："、"1. "、"No.1: "
  const prefixMatch = clean.match(/^(?:卡密\s*\d+\s*[:：]|\d+[\.、]\s*|No\.\s*\d+\s*[:：])\s*/i);
  if (prefixMatch) {
    clean = clean.slice(prefixMatch[0].length).trim();
  }

  let email = '';
  let password = '';
  let token = '';

  // 1. 优先尝试 "----" 分隔符 (注意：Token 本身可能以 "--" 开头，因此只按前两个 "----" 拆分)
  if (clean.includes('----')) {
    const firstIdx = clean.indexOf('----');
    email = clean.slice(0, firstIdx).trim();
    const rest = clean.slice(firstIdx + 4);
    const secondIdx = rest.indexOf('----');
    if (secondIdx !== -1) {
      password = rest.slice(0, secondIdx).trim();
      token = rest.slice(secondIdx + 4).trim();
    } else {
      // 只有一段 ---- 时，当作 email----token
      token = rest.trim();
    }
  } else if (clean.includes('---')) {
    const parts = clean.split('---').map((p) => p.trim());
    if (parts.length >= 3) {
      email = parts[0] as string;
      password = parts[1] as string;
      token = parts.slice(2).join('---').trim();
    } else if (parts.length === 2) {
      email = parts[0] as string;
      token = parts[1] as string;
    }
  } else if (clean.includes('|')) {
    const parts = clean.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      email = parts[0] as string;
      password = parts[1] as string;
      token = parts.slice(2).join('|').trim();
    } else if (parts.length === 2) {
      email = parts[0] as string;
      token = parts[1] as string;
    }
  } else if (clean.includes(',')) {
    const parts = clean.split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      email = parts[0] as string;
      password = parts[1] as string;
      token = parts.slice(2).join(',').trim();
    } else if (parts.length === 2) {
      email = parts[0] as string;
      token = parts[1] as string;
    }
  } else if (/\s{2,}|\t/.test(clean)) {
    // 两个以上空格或制表符
    const parts = clean.split(/\s{2,}|\t/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      email = parts[0] as string;
      password = parts[1] as string;
      token = parts.slice(2).join(' ').trim();
    } else if (parts.length === 2) {
      email = parts[0] as string;
      token = parts[1] as string;
    }
  } else {
    // 仅有一串长 token 的情况 (必须符合 base64url/token 字符集且长度至少为 30，且不含中文/空格)
    if (/^[A-Za-z0-9_\-\.]{30,}$/.test(clean)) {
      token = clean;
      email = `account_${index}@auto.local`;
    }
  }

  if (!token) {
    return {
      lineIndex: index,
      rawLine: line,
      reason: '无法识别有效 Token 凭证',
      sourceName,
    };
  }

  return {
    index,
    email: email || `account_${index}@auto.local`,
    password: password || undefined,
    token,
    platform,
    rawLine: line,
    sourceName,
  };
}

/**
 * 批量解析卡密文本内容
 */
export function parseCardKeys(text: string, options: CardKeyConvertOptions = {}): CardKeyParseResult {
  const lines = text.split(/\r?\n/);
  const records: CardKeyRecord[] = [];
  const skipped: CardKeyError[] = [];
  const tokens: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (!line.trim()) {
      continue;
    }
    const result = parseCardKeyLine(line, i + 1, options);
    if ('token' in result) {
      records.push(result);
      tokens.push(result.token);
    } else {
      skipped.push(result);
    }
  }

  return { records, skipped, tokens };
}

/**
 * 构建 Sub2API 导入格式的 JSON 文档
 */
export function buildSub2ApiDocument(
  records: CardKeyRecord[],
  platform: CardKeyPlatform = 'grok',
  now: Date = new Date(),
) {
  return {
    type: 'sub2api-data',
    version: 1,
    exported_at: now.toISOString(),
    proxies: [],
    accounts: records.map((record) => {
      const extra: Record<string, unknown> = {
        email: record.email,
      };
      if (record.password) {
        extra.password = record.password;
      }
      return {
        name: record.email,
        platform: record.platform || platform,
        type: 'oauth',
        credentials: {
          refresh_token: record.token,
        },
        extra,
        status: 'active',
      };
    }),
  };
}

/**
 * 构建 CPA (cliProxyAPI) 格式的 JSON 数组
 */
export function buildCpaDocument(records: CardKeyRecord[]) {
  return records.map((record) => ({
    email: record.email,
    refresh_token: record.token,
    type: 'oauth',
  }));
}

/**
 * 直接从原始卡密文本中仅提取 Grok Refresh Token（每行一个）
 */
export function extractGrokTokens(rawText: string): string {
  const { records } = parseCardKeys(rawText, { platform: 'grok' });
  return records.map((r) => r.token).join('\n');
}

/**
 * 直接从原始卡密文本中仅提取 Refresh Token（每行一个）
 */
export function extractTokens(rawText: string, platform: CardKeyPlatform = 'grok'): string {
  const { records } = parseCardKeys(rawText, { platform });
  return records.map((r) => r.token).join('\n');
}

/**
 * 根据所选输出格式生成最终文本
 */
export function generateOutput(
  records: CardKeyRecord[],
  format: CardKeyOutputFormat,
  platform: CardKeyPlatform = 'grok',
  now: Date = new Date(),
): string {
  if (records.length === 0) {
    return '';
  }

  switch (format) {
    case 'sub2api': {
      const doc = buildSub2ApiDocument(records, platform, now);
      return JSON.stringify(doc, null, 2);
    }
    case 'tokens': {
      return records.map((r) => r.token).join('\n');
    }
    case 'cards': {
      return records
        .map((r) => `${r.email}----${r.password ?? ''}----${r.token}`)
        .join('\n');
    }
    case 'cpa': {
      const doc = buildCpaDocument(records);
      return JSON.stringify(doc, null, 2);
    }
  }
}
