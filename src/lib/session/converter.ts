// ChatGPT Session 转换引擎：纯函数，无 DOM 依赖
// 输入 ChatGPT 会话 JSON，输出 sub2api / CPA / Cockpit / 9router / AxonHub / Codex-Manager 六种格式

export type SessionFormat = 'sub2api' | 'cpa' | 'cockpit' | '9router' | 'axonhub' | 'codexmanager';

export const SESSION_FORMAT_LABELS: Record<SessionFormat, string> = {
  sub2api: 'sub2api',
  cpa: 'CPA',
  cockpit: 'Cockpit',
  '9router': '9router',
  axonhub: 'AxonHub',
  codexmanager: 'Codex-Manager',
};

export interface ConvertOptions {
  cpaExpirePlus24h?: boolean;
  omitIdTokenForPlus?: boolean;
  now?: Date;
  sourceName?: string;
  sourcePath?: string;
}

export interface SessionLikeRecord {
  // 宽松类型：实际字段通过访问器函数提取，兼容多种来源格式
  [key: string]: unknown;
}

export interface ConvertError {
  sourceName: string;
  path: string;
  reason: string;
}

// ---------- 基础工具 ----------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    for (let i = 0; i < chunk.length; i += 1) {
      binary += String.fromCharCode(chunk[i] as number);
    }
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeBase64UrlJson(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

interface JwtPayload {
  exp?: number;
  email?: string;
  workspace_id?: string;
  'https://api.openai.com/auth'?: Record<string, unknown>;
  'https://api.openai.com/profile'?: Record<string, unknown>;
  [key: string]: unknown;
}

function parseJwtPayload(token: string | undefined): JwtPayload | undefined {
  if (typeof token !== 'string' || token.trim() === '') {
    return undefined;
  }
  const segments = token.split('.');
  if (segments.length < 2) {
    return undefined;
  }
  try {
    return JSON.parse(decodeBase64Url(segments[1] as string)) as JwtPayload;
  } catch {
    return undefined;
  }
}

function getOpenAIAuthSection(payload: JwtPayload | undefined): Record<string, unknown> {
  if (!isPlainObject(payload)) {
    return {};
  }
  const auth = payload['https://api.openai.com/auth'];
  return isPlainObject(auth) ? auth : {};
}

function getOpenAIProfileSection(payload: JwtPayload | undefined): Record<string, unknown> {
  if (!isPlainObject(payload)) {
    return {};
  }
  const profile = payload['https://api.openai.com/profile'];
  return isPlainObject(profile) ? profile : {};
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function timestampFromUnixSeconds(value: unknown): string | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const date = new Date(numeric * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeDateOnly(value: unknown): string | undefined {
  const normalized = normalizeTimestamp(value);
  return normalized ? normalized.slice(0, 10) : undefined;
}

function epochSecondsFromValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.trunc(numeric > 1e11 ? numeric / 1000 : numeric);
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed / 1000) : 0;
}

const SUB_DEFAULT_PRIVACY_MODE = 'training_off';
const AXONHUB_PLACEHOLDER_REFRESH_TOKEN = '__missing_refresh_token__';

// ---------- 时间与优先级 ----------

function getPriorityDayOffset(date: Date = new Date()): number {
  const baseDay = Date.UTC(2026, 5, 14);
  const currentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((currentDay - baseDay) / (24 * 60 * 60 * 1000));
}

function getDynamicPriority(date: Date = new Date()): number {
  return 10000 - getPriorityDayOffset(date);
}

function getSub2apiPriority(date: Date = new Date()): number {
  return 10000 + getPriorityDayOffset(date);
}

function getForcedRefreshExpiresAt(now: Date, expiresAt: string | undefined, cpaExpirePlus24h: boolean): string | undefined {
  if (cpaExpirePlus24h) {
    return normalizeTimestamp(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  }
  return normalizeTimestamp(expiresAt);
}

function getExpiresIn(expiresAt: string | undefined, now: Date = new Date()): number | undefined {
  if (!expiresAt) {
    return undefined;
  }
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return undefined;
  }
  return Math.max(0, Math.floor((expiresMs - now.getTime()) / 1000));
}

function getAxonHubLastRefresh(expiresAt: string | undefined, now: Date = new Date()): string {
  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  if (Number.isNaN(expiresMs)) {
    return normalizeTimestamp(now) as string;
  }
  return new Date(expiresMs - 60 * 60 * 1000).toISOString();
}

// ---------- 合成 id_token ----------

function buildSyntheticCodexIdToken(
  email: string | undefined,
  accountId: string | undefined,
  planType: string | undefined,
  userId: string | undefined,
  expiresAt: string | undefined,
): string | undefined {
  if (!accountId) {
    return undefined;
  }
  const now = Math.trunc(Date.now() / 1000);
  const authInfo: Record<string, unknown> = { chatgpt_account_id: accountId };
  const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;
  if (planType) {
    authInfo.chatgpt_plan_type = planType;
  }
  if (userId) {
    authInfo.chatgpt_user_id = userId;
    authInfo.user_id = userId;
  }
  const payload: Record<string, unknown> = {
    iat: now,
    exp: expires,
    'https://api.openai.com/auth': authInfo,
  };
  if (email) {
    payload.email = email;
  }
  return `${encodeBase64UrlJson({ alg: 'none', typ: 'JWT', cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.synthetic`;
}

// ---------- 清理工具 ----------

function stripUnavailable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnavailable).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, stripUnavailable(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value;
}

const BLOCKED_ID_KEYS = new Set(['id_token', 'idToken', 'id_token_synthetic']);

function stripIdTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripIdTokenFields);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !BLOCKED_ID_KEYS.has(key))
      .map(([key, item]) => [key, stripIdTokenFields(item)]),
  );
}

function applyPlusModelIdTokenMode(value: unknown, omitIdTokenForPlus: boolean): unknown {
  return omitIdTokenForPlus ? stripIdTokenFields(value) : value;
}

function toEmailKey(email: string | undefined): string | undefined {
  if (typeof email !== 'string') {
    return undefined;
  }
  return (
    email
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || undefined
  );
}

// ---------- 字段访问器 ----------

function nested(record: unknown, ...paths: string[]): unknown {
  if (!isPlainObject(record)) {
    return undefined;
  }
  let current: unknown = record;
  for (const path of paths) {
    current = (current as Record<string, unknown>)?.[path];
  }
  return current;
}

// ---------- 核心转换 ----------

export interface ConvertedSession {
  sourceName: string;
  sourcePath?: string;
  email: string | undefined;
  name: string;
  expiresAt: string | undefined;
  effectiveExpiresAt: string | undefined;
  priority: number;
  sub2apiPriority: number;
  cpa: Record<string, unknown>;
  cockpit: Record<string, unknown>;
  nineRouter: Record<string, unknown> | undefined;
  axonHub: Record<string, unknown>;
  codexManager: Record<string, unknown>;
  sub2apiAccount: Record<string, unknown>;
}

export function convertSession(record: SessionLikeRecord, options: ConvertOptions = {}): ConvertedSession {
  if (!isPlainObject(record)) {
    throw new Error('session 不是 JSON 对象');
  }

  const accessToken = firstNonEmpty(
    record.accessToken, record.access_token,
    nested(record, 'tokens', 'accessToken'), nested(record, 'tokens', 'access_token'),
    nested(record, 'token', 'accessToken'), nested(record, 'token', 'access_token'),
    nested(record, 'credentials', 'accessToken'), nested(record, 'credentials', 'access_token'),
  );
  if (!accessToken) {
    throw new Error('缺少 accessToken');
  }

  const sessionToken = firstNonEmpty(
    record.sessionToken, record.session_token,
    nested(record, 'tokens', 'sessionToken'), nested(record, 'tokens', 'session_token'),
    nested(record, 'token', 'sessionToken'), nested(record, 'token', 'session_token'),
    nested(record, 'credentials', 'session_token'),
  );
  const refreshToken = firstNonEmpty(
    record.refreshToken, record.refresh_token,
    nested(record, 'tokens', 'refreshToken'), nested(record, 'tokens', 'refresh_token'),
    nested(record, 'token', 'refreshToken'), nested(record, 'token', 'refresh_token'),
    nested(record, 'credentials', 'refresh_token'),
  );
  const inputIdToken = firstNonEmpty(
    record.idToken, record.id_token,
    nested(record, 'tokens', 'idToken'), nested(record, 'tokens', 'id_token'),
    nested(record, 'token', 'idToken'), nested(record, 'token', 'id_token'),
    nested(record, 'credentials', 'id_token'),
  );

  const payload = parseJwtPayload(accessToken);
  const idPayload = parseJwtPayload(inputIdToken);
  const auth = getOpenAIAuthSection(payload);
  const idAuth = getOpenAIAuthSection(idPayload);
  const profile = getOpenAIProfileSection(payload);

  const expiresAt = firstNonEmpty(
    payload?.exp ? timestampFromUnixSeconds(payload.exp) : undefined,
    normalizeTimestamp(record.expires),
    normalizeTimestamp(record.expiresAt),
    normalizeTimestamp(record.expired),
    normalizeTimestamp(record.expires_at),
  );

  const email = firstNonEmpty(
    nested(record, 'user', 'email'), record.email,
    nested(record, 'meta', 'label'), record.label,
    nested(record, 'credentials', 'email'),
    nested(record, 'providerSpecificData', 'email'),
    profile.email, idPayload?.email, payload?.email,
  );

  const accountId = firstNonEmpty(
    nested(record, 'account', 'id'), record.account_id,
    nested(record, 'tokens', 'accountId'), nested(record, 'tokens', 'account_id'),
    record.chatgptAccountId, record.chatgpt_account_id,
    nested(record, 'meta', 'chatgptAccountId'), nested(record, 'meta', 'chatgpt_account_id'),
    nested(record, 'tokens', 'chatgptAccountId'), nested(record, 'tokens', 'chatgpt_account_id'),
    nested(record, 'providerSpecificData', 'chatgptAccountId'),
    nested(record, 'providerSpecificData', 'chatgpt_account_id'),
    nested(record, 'credentials', 'chatgpt_account_id'),
    auth.chatgpt_account_id, idAuth.chatgpt_account_id,
    record.provider === 'codex' ? record.id : undefined,
  );

  const chatgptAccountId = firstNonEmpty(
    record.chatgptAccountId, record.chatgpt_account_id,
    nested(record, 'meta', 'chatgptAccountId'), nested(record, 'meta', 'chatgpt_account_id'),
    nested(record, 'tokens', 'chatgptAccountId'), nested(record, 'tokens', 'chatgpt_account_id'),
    nested(record, 'providerSpecificData', 'chatgptAccountId'),
    nested(record, 'providerSpecificData', 'chatgpt_account_id'),
    nested(record, 'credentials', 'chatgpt_account_id'),
    auth.chatgpt_account_id, idAuth.chatgpt_account_id,
  );

  const workspaceId = firstNonEmpty(
    nested(record, 'account', 'workspaceId'), nested(record, 'account', 'workspace_id'),
    record.workspaceId, record.workspace_id,
    nested(record, 'meta', 'workspaceId'), nested(record, 'meta', 'workspace_id'),
    nested(record, 'providerSpecificData', 'workspaceId'),
    nested(record, 'providerSpecificData', 'workspace_id'),
    nested(record, 'credentials', 'workspace_id'),
    payload?.workspace_id, idPayload?.workspace_id,
  );

  const orgList = (src: unknown) =>
    Array.isArray(src) ? (src as Array<Record<string, unknown>>).find((item) => item?.id)?.id : undefined;
  const organizationId = firstNonEmpty(
    record.organizationId, record.organization_id,
    nested(record, 'meta', 'organizationId'), nested(record, 'meta', 'organization_id'),
    nested(record, 'providerSpecificData', 'organizationId'),
    nested(record, 'providerSpecificData', 'organization_id'),
    nested(record, 'credentials', 'organization_id'),
    auth.organization_id, idAuth.organization_id,
    orgList(auth.organizations), orgList(idAuth.organizations),
  );

  const userId = firstNonEmpty(
    nested(record, 'user', 'id'), record.user_id, record.chatgptUserId,
    nested(record, 'providerSpecificData', 'chatgptUserId'),
    nested(record, 'providerSpecificData', 'chatgpt_user_id'),
    auth.chatgpt_user_id, auth.user_id,
    idAuth.chatgpt_user_id, idAuth.user_id,
  );

  const planType = firstNonEmpty(
    nested(record, 'account', 'planType'), nested(record, 'account', 'plan_type'),
    record.planType, record.plan_type,
    nested(record, 'providerSpecificData', 'chatgptPlanType'),
    nested(record, 'providerSpecificData', 'chatgpt_plan_type'),
    nested(record, 'credentials', 'plan_type'),
    auth.chatgpt_plan_type, idAuth.chatgpt_plan_type,
  );

  const privacyMode = firstNonEmpty(
    record.privacyMode, record.privacy_mode,
    nested(record, 'meta', 'privacyMode'), nested(record, 'meta', 'privacy_mode'),
    nested(record, 'providerSpecificData', 'privacyMode'),
    nested(record, 'providerSpecificData', 'privacy_mode'),
    nested(record, 'extra', 'privacy_mode'),
    SUB_DEFAULT_PRIVACY_MODE,
  );

  const websocketMode = firstNonEmpty(
    record.openaiOauthResponsesWebsocketsV2Mode,
    record.openai_oauth_responses_websockets_v2_mode,
    nested(record, 'meta', 'openaiOauthResponsesWebsocketsV2Mode'),
    nested(record, 'meta', 'openai_oauth_responses_websockets_v2_mode'),
    nested(record, 'providerSpecificData', 'openaiOauthResponsesWebsocketsV2Mode'),
    nested(record, 'providerSpecificData', 'openai_oauth_responses_websockets_v2_mode'),
    nested(record, 'extra', 'openai_oauth_responses_websockets_v2_mode'),
    'off',
  );

  const boolField = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : undefined;
  const websocketEnabled =
    boolField(record.openaiOauthResponsesWebsocketsV2Enabled) ??
    boolField(record.openai_oauth_responses_websockets_v2_enabled) ??
    boolField(nested(record, 'meta', 'openaiOauthResponsesWebsocketsV2Enabled')) ??
    boolField(nested(record, 'meta', 'openai_oauth_responses_websockets_v2_enabled')) ??
    boolField(nested(record, 'providerSpecificData', 'openaiOauthResponsesWebsocketsV2Enabled')) ??
    boolField(nested(record, 'providerSpecificData', 'openai_oauth_responses_websockets_v2_enabled')) ??
    boolField(nested(record, 'extra', 'openai_oauth_responses_websockets_v2_enabled')) ??
    false;

  const convertNow = options.now ?? new Date();
  const exportedAt = normalizeTimestamp(convertNow);
  const effectiveExpiresAt = getForcedRefreshExpiresAt(convertNow, expiresAt, Boolean(options.cpaExpirePlus24h));
  const expiresIn = getExpiresIn(effectiveExpiresAt, convertNow);
  const sourceName = firstNonEmpty(options.sourceName, 'pasted-json') as string;
  const sourceType = record.provider === 'codex' && record.authType === 'oauth' ? '9router' : 'chatgpt_web_session';
  const name = firstNonEmpty(email, sourceName, 'ChatGPT Account') as string;

  const syntheticIdToken = !inputIdToken
    ? buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt)
    : undefined;
  const idToken = firstNonEmpty(inputIdToken, syntheticIdToken);

  const dynamicPriority = getDynamicPriority(convertNow);
  const sub2apiPriority = getSub2apiPriority(convertNow);

  // CPA
  const cpa = Object.fromEntries(
    Object.entries({
      type: 'codex',
      email,
      name,
      priority: dynamicPriority,
      id_token: idToken,
      id_token_synthetic: Boolean(syntheticIdToken) || undefined,
      access_token: accessToken,
      refresh_token: refreshToken || '',
      session_token: sessionToken,
      last_refresh: normalizeTimestamp(convertNow),
      expired: effectiveExpiresAt,
      note: normalizeDateOnly(convertNow),
      disabled: Boolean(record.disabled) || undefined,
      // 保留提取到的扩展字段（privacy/websocket/org），不丢弃
      privacy_mode: privacyMode,
      openai_oauth_responses_websockets_v2_mode: websocketMode,
      openai_oauth_responses_websockets_v2_enabled: websocketEnabled || undefined,
      workspace_id: workspaceId,
      organization_id: organizationId,
    }).filter(([, value]) => value !== undefined && value !== null),
  );

  // Cockpit
  const cockpit = {
    type: 'codex',
    priority: dynamicPriority,
    id_token: idToken,
    access_token: accessToken,
    refresh_token: refreshToken || '',
    account_id: accountId,
    last_refresh: exportedAt,
    email,
    expired: expiresAt,
    account_note: firstNonEmpty(record.account_note, record.accountInfo, record.account_info, record.note, record.notes, record.remark),
  };

  // sub2api account
  const sub2apiAccount = stripUnavailable({
    name,
    platform: 'openai',
    type: 'oauth',
    concurrency: 10,
    priority: sub2apiPriority,
    notes: normalizeDateOnly(convertNow),
    credentials: {
      access_token: accessToken,
      chatgpt_user_id: userId,
      email,
      expires_at: effectiveExpiresAt,
      expires_in: expiresIn,
      id_token: idToken,
      refresh_token: refreshToken,
    },
    extra: {
      email,
      email_key: toEmailKey(email),
      name,
      source: sourceType,
      last_refresh: exportedAt,
    },
  }) as Record<string, unknown>;

  // 9router
  const isActive = typeof record.isActive === 'boolean' ? record.isActive : !Boolean(record.disabled);
  const createdAt = normalizeTimestamp(record.createdAt) || exportedAt;
  const updatedAt = normalizeTimestamp(record.updatedAt) || exportedAt;
  const nineRouter = stripUnavailable({
    accessToken,
    refreshToken,
    expiresAt,
    testStatus: firstNonEmpty(record.testStatus, record.test_status, 'active'),
    expiresIn,
    providerSpecificData: {
      chatgptAccountId: accountId,
      chatgptPlanType: planType,
    },
    id: accountId,
    provider: 'codex',
    authType: 'oauth',
    name,
    email,
    priority: sub2apiPriority,
    isActive,
    createdAt,
    updatedAt,
  }) as Record<string, unknown>;

  // AxonHub
  const axonHubRefreshToken = refreshToken || AXONHUB_PLACEHOLDER_REFRESH_TOKEN;
  const axonHub = stripUnavailable({
    auth_mode: 'chatgpt',
    priority: sub2apiPriority,
    last_refresh: getAxonHubLastRefresh(expiresAt, options.now ?? new Date()),
    tokens: {
      access_token: accessToken,
      refresh_token: axonHubRefreshToken,
      id_token: idToken,
    },
    axonhub_refresh_token_placeholder: refreshToken ? undefined : true,
    axonhub_note: refreshToken ? undefined : 'refresh_token is a placeholder; access_token works only until it expires.',
  }) as Record<string, unknown>;

  // Codex-Manager
  const codexManagerTokenHints = Object.fromEntries(
    Object.entries({
      account_id: accountId,
      chatgpt_account_id: chatgptAccountId,
    }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const codexManagerMeta = Object.fromEntries(
    Object.entries({
      label: firstNonEmpty(name, email, sourceName, 'ChatGPT Account'),
      workspace_id: workspaceId,
      chatgpt_account_id: chatgptAccountId,
      note: 'Imported from ChatGPT session',
    }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const codexManager = {
    sort: sub2apiPriority,
    priority: sub2apiPriority,
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken || '',
      id_token: inputIdToken || '',
      ...codexManagerTokenHints,
    },
    meta: codexManagerMeta,
  };

  return {
    sourceName,
    sourcePath: options.sourcePath,
    email,
    name,
    expiresAt,
    effectiveExpiresAt,
    priority: dynamicPriority,
    sub2apiPriority,
    cpa,
    cockpit,
    nineRouter,
    axonHub,
    codexManager,
    sub2apiAccount,
  };
}

// ---------- 输入解析：从任意 JSON 结构中收集 session 对象 ----------

interface FoundSession {
  sourceName: string;
  path: string;
  value: SessionLikeRecord;
}

function collectSessionLikeObjects(value: unknown, sourceName = 'pasted-json'): FoundSession[] {
  const found: FoundSession[] = [];
  const visited = new WeakSet();

  function visit(item: unknown, path: string) {
    if (!isPlainObject(item) && !Array.isArray(item)) {
      return;
    }
    if (isPlainObject(item)) {
      if (visited.has(item)) {
        return;
      }
      visited.add(item);

      const token = firstNonEmpty(
        item.accessToken, item.access_token,
        nested(item, 'tokens', 'accessToken'), nested(item, 'tokens', 'access_token'),
        nested(item, 'token', 'accessToken'), nested(item, 'token', 'access_token'),
        nested(item, 'credentials', 'accessToken'), nested(item, 'credentials', 'access_token'),
      );
      const hasIdentity =
        isPlainObject(item.user) ||
        firstNonEmpty(item.email, item.name, item.label, nested(item, 'meta', 'label'));

      if (token && hasIdentity) {
        found.push({ sourceName, path, value: item });
        // 继续向下找嵌套的 session（一个文档可能包含多个）
      }
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
    } else if (isPlainObject(item)) {
      for (const [key, child] of Object.entries(item)) {
        visit(child, `${path}.${key}`);
      }
    }
  }

  visit(value, '$');
  return found;
}

function extractJsonSlices(text: string): string[] {
  const slices: string[] = [];
  const regex = /\{[\s\S]*?\}(?=\s*$|\s*\{|\s*\n)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    slices.push(match[0]);
  }
  return slices;
}

function parseLineDelimitedDocuments(text: string, sourceName: string): FoundSession[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const found: FoundSession[] = [];
  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line);
      found.push(...collectSessionLikeObjects(parsed, sourceName));
    } catch {
      // 单行非 JSON，忽略，path 标记行号
      void index;
    }
  });
  if (!found.length) {
    throw new Error('未找到可解析的 JSON 文档');
  }
  return found;
}

export function parseInputDocuments(text: string, sourceName = 'pasted-json'): FoundSession[] {
  if (typeof text !== 'string' || text.trim() === '') {
    return [];
  }
  try {
    return collectSessionLikeObjects(JSON.parse(text), sourceName);
  } catch (documentError) {
    const jsonSlices = extractJsonSlices(text);
    if (jsonSlices.length) {
      try {
        const found: FoundSession[] = [];
        jsonSlices.forEach((jsonSlice) => {
          found.push(...collectSessionLikeObjects(JSON.parse(jsonSlice), sourceName));
        });
        return found;
      } catch {
        // 继续尝试逐行解析
      }
    }
    try {
      return parseLineDelimitedDocuments(text, sourceName);
    } catch {
      throw new Error(`JSON 解析失败：${documentError instanceof Error ? documentError.message : String(documentError)}`);
    }
  }
}

export interface ConvertResult {
  converted: ConvertedSession[];
  skipped: ConvertError[];
  rawDocuments: FoundSession[];
}

export function convertInput(
  text: string,
  options: ConvertOptions = {},
): ConvertResult {
  const documents = parseInputDocuments(text, options.sourceName ?? 'pasted-json');
  const now = options.now ?? new Date();
  const converted: ConvertedSession[] = [];
  const skipped: ConvertError[] = [];

  documents.forEach((item) => {
    try {
      converted.push(
        convertSession(item.value, {
          now,
          cpaExpirePlus24h: options.cpaExpirePlus24h,
          sourceName: item.sourceName,
          sourcePath: item.path,
        }),
      );
    } catch (error) {
      skipped.push({
        sourceName: item.sourceName,
        path: item.path,
        reason: error instanceof Error ? error.message : '无法转换',
      });
    }
  });

  return { converted, skipped, rawDocuments: documents };
}

// ---------- 输出文档构建 ----------

export function buildOutputDocument(
  converted: ConvertedSession[],
  format: SessionFormat,
  omitIdTokenForPlus: boolean,
): unknown {
  let document: unknown;
  if (format === 'sub2api') {
    document = {
      exported_at: normalizeTimestamp(new Date()),
      proxies: [],
      accounts: converted.map((item) => item.sub2apiAccount),
    };
  } else {
    const key: keyof ConvertedSession =
      format === 'cpa' ? 'cpa'
        : format === 'cockpit' ? 'cockpit'
          : format === '9router' ? 'nineRouter'
            : format === 'axonhub' ? 'axonHub'
              : 'codexManager';
    document =
      converted.length === 1
        ? converted[0]![key]
        : converted.map((item) => item[key]);
  }
  return applyPlusModelIdTokenMode(document, omitIdTokenForPlus);
}

// ---------- 文件名清理 ----------

export function sanitizeFileToken(value: string | undefined, fallback = 'chatgpt-session'): string {
  const base = firstNonEmpty(value, fallback) || fallback;
  return (
    base
      .replace(/\.[^.]+$/u, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 80) || fallback
  );
}

export function sanitizeArchiveEntryName(value: string | undefined, fallback = 'account'): string {
  const base = firstNonEmpty(value, fallback) || fallback;
  return (
    base
      .replace(/[/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || fallback
  );
}

export const EXAMPLE_SESSION = {
  user: { id: 'user-example', email: 'mark@example.com' },
  expires: '2026-08-06T14:29:36.155Z',
  account: { id: '00000000-0000-4000-9000-000000000000', planType: 'plus' },
  accessToken: 'paste-real-access-token-here',
  refreshToken: 'paste-real-refresh-token-here',
  idToken: 'paste-real-id-token-here',
};
