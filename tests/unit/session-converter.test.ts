import { describe, expect, it } from 'vitest';

import {
  buildOutputDocument,
  convertInput,
  convertSession,
  parseInputDocuments,
  sanitizeArchiveEntryName,
  sanitizeFileToken,
  type SessionFormat,
} from '../../src/lib/session/converter';

const FIXED_NOW = new Date('2026-07-31T00:00:00.000Z');

function makeExampleSession(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1', email: 'ada@example.com' },
    expires: '2026-08-10T00:00:00.000Z',
    account: { id: 'acc-001', planType: 'plus' },
    accessToken: 'access-token-aaa',
    refreshToken: 'refresh-token-rrr',
    idToken: 'id-token-iii',
    ...overrides,
  };
}

describe('ChatGPT Session 转换引擎', () => {
  describe('convertSession', () => {
    it('缺少 accessToken 时抛出错误', () => {
      expect(() => convertSession({ user: { email: 'a@b.com' } }, { now: FIXED_NOW })).toThrow('缺少 accessToken');
    });

    it('从顶层字段提取 token 与身份信息', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.email).toBe('ada@example.com');
      expect(result.name).toBe('ada@example.com');
      expect(result.cpa.access_token).toBe('access-token-aaa');
      expect(result.cpa.refresh_token).toBe('refresh-token-rrr');
    });

    it('从 snake_case 字段提取', () => {
      const result = convertSession(
        {
          access_token: 'at',
          refresh_token: 'rt',
          id_token: 'it',
          email: 'grace@example.com',
          account: { id: 'acc-2' },
        },
        { now: FIXED_NOW },
      );
      expect(result.cpa.access_token).toBe('at');
      expect(result.email).toBe('grace@example.com');
    });

    it('从嵌套 tokens 对象提取', () => {
      const result = convertSession(
        {
          tokens: { accessToken: 'nested-at', refreshToken: 'nested-rt' },
          user: { email: 'nested@example.com' },
          account: { id: 'acc-3' },
        } as Record<string, unknown>,
        { now: FIXED_NOW },
      );
      expect(result.cpa.access_token).toBe('nested-at');
      expect(result.email).toBe('nested@example.com');
    });

    it('CPA 格式包含核心字段', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.cpa).toMatchObject({
        type: 'codex',
        email: 'ada@example.com',
        access_token: 'access-token-aaa',
        refresh_token: 'refresh-token-rrr',
        id_token: 'id-token-iii',
      });
    });

    it('Cockpit 格式包含 account_id 与 expired', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.cockpit).toMatchObject({
        type: 'codex',
        account_id: 'acc-001',
        email: 'ada@example.com',
        access_token: 'access-token-aaa',
      });
      expect(result.cockpit.expired).toBeDefined();
    });

    it('sub2api account 格式包含 credentials', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.sub2apiAccount.platform).toBe('openai');
      expect(result.sub2apiAccount.type).toBe('oauth');
      const creds = result.sub2apiAccount.credentials as Record<string, unknown>;
      expect(creds.access_token).toBe('access-token-aaa');
    });

    it('9router 格式包含 providerSpecificData', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.nineRouter).toBeDefined();
      expect(result.nineRouter?.provider).toBe('codex');
      const psd = result.nineRouter?.providerSpecificData as Record<string, unknown>;
      expect(psd.chatgptAccountId).toBe('acc-001');
    });

    it('AxonHub 缺少 refreshToken 时使用占位符', () => {
      const result = convertSession(
        { accessToken: 'at', user: { email: 'a@b.com' }, account: { id: 'acc-x' } },
        { now: FIXED_NOW },
      );
      expect(result.axonHub.auth_mode).toBe('chatgpt');
      const tokens = result.axonHub.tokens as Record<string, unknown>;
      expect(tokens.refresh_token).toBe('__missing_refresh_token__');
      expect(result.axonHub.axonhub_refresh_token_placeholder).toBe(true);
    });

    it('Codex-Manager 格式包含 meta 与 tokens', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.codexManager.meta).toMatchObject({
        label: 'ada@example.com',
        note: 'Imported from ChatGPT session',
      });
    });
  });

  describe('合成 id_token', () => {
    it('缺少 idToken 且有 accountId 时合成 id_token', () => {
      const result = convertSession(
        {
          accessToken: 'at',
          user: { email: 'synth@example.com' },
          account: { id: 'acc-synth', planType: 'plus' },
        },
        { now: FIXED_NOW },
      );
      expect(result.cpa.id_token).toMatch(/\.synthetic$/);
      expect(result.cpa.id_token_synthetic).toBe(true);
    });

    it('有 idToken 时不合成', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.cpa.id_token).toBe('id-token-iii');
      expect(result.cpa.id_token_synthetic).toBeUndefined();
    });
  });

  describe('CPA +24h 选项', () => {
    it('cpaExpirePlus24h 将 expired 强制为 now+24h', () => {
      const result = convertSession(makeExampleSession(), {
        now: FIXED_NOW,
        cpaExpirePlus24h: true,
      });
      expect(result.effectiveExpiresAt).toBe('2026-08-01T00:00:00.000Z');
      expect(result.cpa.expired).toBe('2026-08-01T00:00:00.000Z');
    });

    it('默认使用原始 expiresAt', () => {
      const result = convertSession(makeExampleSession(), { now: FIXED_NOW });
      expect(result.effectiveExpiresAt).toBe('2026-08-10T00:00:00.000Z');
    });
  });

  describe('parseInputDocuments', () => {
    it('解析单个 session 对象', () => {
      const docs = parseInputDocuments(JSON.stringify(makeExampleSession()));
      expect(docs).toHaveLength(1);
    });

    it('从数组中提取多个 session', () => {
      const docs = parseInputDocuments(
        JSON.stringify([makeExampleSession({ user: { email: 'a@x.com' } }), makeExampleSession({ user: { email: 'b@x.com' } })]),
      );
      expect(docs).toHaveLength(2);
    });

    it('空字符串返回空数组', () => {
      expect(parseInputDocuments('')).toHaveLength(0);
    });

    it('无效 JSON 抛出错误', () => {
      expect(() => parseInputDocuments('not json at all')).toThrow();
    });
  });

  describe('convertInput', () => {
    it('批量转换并统计结果', () => {
      const result = convertInput(
        JSON.stringify([
          makeExampleSession({ user: { email: 'ok@example.com' } }),
          // 无 accessToken 且无身份：不会被收集为 session 候选
          { refreshToken: 'no-access-token' },
        ]),
        { now: FIXED_NOW },
      );
      expect(result.converted).toHaveLength(1);
      // 收集阶段即过滤，不会进入转换或跳过
      expect(result.skipped).toHaveLength(0);
      expect(result.rawDocuments).toHaveLength(1);
    });
  });

  describe('buildOutputDocument', () => {
    const formats: SessionFormat[] = ['sub2api', 'cpa', 'cockpit', '9router', 'axonhub', 'codexmanager'];
    const converted = convertInput(JSON.stringify(makeExampleSession()), { now: FIXED_NOW }).converted;

    it.each(formats)('格式 %s 生成有效输出结构', (format) => {
      const doc = buildOutputDocument(converted, format, false);
      expect(doc).toBeDefined();
      if (format === 'sub2api') {
        expect(doc).toHaveProperty('accounts');
        expect(doc).toHaveProperty('exported_at');
      }
    });

    it('omitIdTokenForPlus 移除 id_token 字段', () => {
      const doc = buildOutputDocument(converted, 'cpa', true) as Record<string, unknown>;
      expect(doc.id_token).toBeUndefined();
    });

    it('单个 session 输出对象，多个输出数组', () => {
      const single = buildOutputDocument(converted, 'cpa', false);
      expect(single).toBeTypeOf('object');
      expect(Array.isArray(single)).toBe(false);

      const multi = convertInput(
        JSON.stringify([makeExampleSession({ user: { email: 'a@x.com' } }), makeExampleSession({ user: { email: 'b@x.com' } })]),
        { now: FIXED_NOW },
      ).converted;
      const multiDoc = buildOutputDocument(multi, 'cpa', false);
      expect(Array.isArray(multiDoc)).toBe(true);
      expect(multiDoc).toHaveLength(2);
    });
  });

  describe('文件名清理', () => {
    it('sanitizeFileToken 清理非法字符', () => {
      expect(sanitizeFileToken('My Session.json')).toBe('my-session');
      // 斜杠被替换为短横，扩展名被去除
      expect(sanitizeFileToken('session export.json')).toBe('session-export');
    });

    it('sanitizeArchiveEntryName 限制长度并清理', () => {
      expect(sanitizeArchiveEntryName('valid name')).toBe('valid-name');
    });
  });
});
