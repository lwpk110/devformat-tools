import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildCpaDocument,
  buildSub2ApiDocument,
  generateOutput,
  parseCardKeyLine,
  parseCardKeys,
  type CardKeyPlatform,
} from '../../src/lib/cardkey/converter';

const FIXED_NOW = new Date('2026-08-25T00:00:00.000Z');

describe('卡密 (Card Key) 转 Sub2API 转换引擎', () => {
  describe('parseCardKeyLine', () => {
    it('正确解析带 "卡密 1: " 前缀的标准卡密', () => {
      const line = '卡密 1: user@outlook.com----pwd123----token_abc123';
      const result = parseCardKeyLine(line, 1, { platform: 'grok', now: FIXED_NOW });
      expect(result).toMatchObject({
        index: 1,
        email: 'user@outlook.com',
        password: 'pwd123',
        token: 'token_abc123',
        platform: 'grok',
      });
    });

    it('正确处理 token 本身以连字符 "--" 开头的情况', () => {
      const line = '卡密 25: rlmrnos13983+9l2qtx@outlook.com----Jm#xAi9kP$2mR7vL!qW4nE8------TSOqf-iIpHUOb0zA8K7p9gVF81i0Lsxqm-VicfbbTL8Bad4fO7Vuq4fA_Rr1b_GBGb8nTvdSz9dy1vuORa-A';
      const result = parseCardKeyLine(line, 25, { platform: 'grok', now: FIXED_NOW });
      expect(result).toMatchObject({
        index: 25,
        email: 'rlmrnos13983+9l2qtx@outlook.com',
        password: 'Jm#xAi9kP$2mR7vL!qW4nE8',
        token: '--TSOqf-iIpHUOb0zA8K7p9gVF81i0Lsxqm-VicfbbTL8Bad4fO7Vuq4fA_Rr1b_GBGb8nTvdSz9dy1vuORa-A',
        platform: 'grok',
      });
    });

    it('兼容数字编号前缀如 "1. " 或 "No.1: "', () => {
      const line = '1. test@example.com----p@ss----token_xyz';
      const result = parseCardKeyLine(line, 1);
      expect(result).toMatchObject({
        email: 'test@example.com',
        password: 'p@ss',
        token: 'token_xyz',
      });
    });

    it('兼容管道符 "|" 分隔符', () => {
      const line = 'pipe@example.com|pass123|token_pipe';
      const result = parseCardKeyLine(line, 1);
      expect(result).toMatchObject({
        email: 'pipe@example.com',
        password: 'pass123',
        token: 'token_pipe',
      });
    });

    it('支持两段式 email----token', () => {
      const line = 'notpwd@example.com----token_only';
      const result = parseCardKeyLine(line, 1);
      expect(result).toMatchObject({
        email: 'notpwd@example.com',
        token: 'token_only',
      });
      if ('token' in result) {
        expect(result.password).toBeUndefined();
      }
    });

    it('空行或无法识别的行返回 error', () => {
      const emptyResult = parseCardKeyLine('   ', 1);
      expect('reason' in emptyResult).toBe(true);

      const invalidResult = parseCardKeyLine('invalid_line_without_token', 1);
      expect('reason' in invalidResult).toBe(true);
    });
  });

  describe('parseCardKeys 批量解析', () => {
    it('自动忽略空白行并成功解析全部卡密', () => {
      const raw = `
卡密 1: a@b.com----p1----t1

卡密 2: c@d.com----p2----t2

      `;
      const result = parseCardKeys(raw, { platform: 'claude' });
      expect(result.records).toHaveLength(2);
      expect(result.tokens).toEqual(['t1', 't2']);
      expect(result.records[0].platform).toBe('claude');
    });

    it('对提供的 100 条样本数据 FF260825440746.txt 能够 100% 完整解析全部 100 个账号', () => {
      const samplePath = join(process.cwd(), '.local', 'FF260825440746.txt');
      const content = readFileSync(samplePath, 'utf8');
      const result = parseCardKeys(content, { platform: 'grok' });

      expect(result.records).toHaveLength(100);
      // 末尾有一行中文备注 "sub导入，带rt，账号，密码" 被自动识别为 skipped
      expect(result.skipped).toHaveLength(1);
      expect(result.tokens).toHaveLength(100);

      // 验证第一条与最后一条记录
      expect(result.records[0].email).toBe('tjznoni48159+9kylxo@outlook.com');
      expect(result.records[0].token).toBe('OojE0C5AYydFgdN093z0GvcrJwPy-6MynXvMClJXm_0UJDtUEUSq8QE2UQw6z8Vyj7twhuRAeI8J298JjDKh9g');

      expect(result.records[99].email).toBe('tolubif54496+9ld9sn@outlook.com');
      expect(result.records[99].token).toBe('KLmHgpF7RfEY6S83Hvk9BNAzC26XV89Xuijmv-i7q8SzUPZ0hEXYpMWVCCbzsnvdG_g_egwYrX_5qg7F4uEu-w');
    });
  });

  describe('输出格式生成', () => {
    const sampleRecords = [
      {
        index: 1,
        email: 'user1@example.com',
        password: 'pwd1',
        token: 'token1',
        platform: 'grok' as CardKeyPlatform,
        rawLine: 'user1@example.com----pwd1----token1',
      },
      {
        index: 2,
        email: 'user2@example.com',
        password: 'pwd2',
        token: 'token2',
        platform: 'grok' as CardKeyPlatform,
        rawLine: 'user2@example.com----pwd2----token2',
      },
    ];

    it('生成 Sub2API JSON 文档', () => {
      const doc = buildSub2ApiDocument(sampleRecords, 'grok', FIXED_NOW);
      expect(doc.type).toBe('sub2api-data');
      expect(doc.version).toBe(1);
      expect(doc.exported_at).toBe('2026-08-25T00:00:00.000Z');
      expect(doc.accounts).toHaveLength(2);
      expect(doc.accounts[0]).toEqual({
        name: 'user1@example.com',
        platform: 'grok',
        type: 'oauth',
        credentials: {
          refresh_token: 'token1',
        },
        extra: {
          email: 'user1@example.com',
          password: 'pwd1',
        },
        status: 'active',
      });
    });

    it('生成纯 Token 列表', () => {
      const output = generateOutput(sampleRecords, 'tokens', 'grok');
      expect(output).toBe('token1\ntoken2');
    });

    it('生成清洗后的卡密列表', () => {
      const output = generateOutput(sampleRecords, 'cards', 'grok');
      expect(output).toBe('user1@example.com----pwd1----token1\nuser2@example.com----pwd2----token2');
    });

    it('生成 CPA JSON 数组', () => {
      const doc = buildCpaDocument(sampleRecords);
      expect(doc).toHaveLength(2);
      expect(doc[0]).toEqual({
        email: 'user1@example.com',
        refresh_token: 'token1',
        type: 'oauth',
      });
    });
  });
});
