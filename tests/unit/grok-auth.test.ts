import { describe, expect, it, vi } from 'vitest';

import {
  XAI_AUTH_CONFIG,
  buildPasswordAuthPayload,
  buildRefreshTokenPayload,
  parseAccountsForAuth,
  refreshGrokToken,
} from '../../src/lib/grok/auth';

describe('Grok / xAI 认证与 Token 刷新逻辑', () => {
  describe('参数构造与解析', () => {
    it('正确构造 refresh_token 刷新请求体', () => {
      const payload = buildRefreshTokenPayload('sample_rt_123456');
      expect(payload.get('grant_type')).toBe('refresh_token');
      expect(payload.get('refresh_token')).toBe('sample_rt_123456');
      expect(payload.get('client_id')).toBe('grok-web');
    });

    it('正确构造 password 认证请求体', () => {
      const payload = buildPasswordAuthPayload({
        email: 'user@example.com',
        password: 'Password123!',
      });
      expect(payload.get('grant_type')).toBe('password');
      expect(payload.get('username')).toBe('user@example.com');
      expect(payload.get('password')).toBe('Password123!');
      expect(payload.get('client_id')).toBe('grok-web');
    });

    it('从卡密格式多行文本中批量解析账号与密码', () => {
      const raw = `
卡密 1: test1@outlook.com----Pass1----Token11111111111111111111111111111111111111111

卡密 2: test2@outlook.com----Pass2

test3@outlook.com----Pass3
      `;
      const accounts = parseAccountsForAuth(raw);
      expect(accounts).toHaveLength(3);
      expect(accounts[0]).toEqual({
        email: 'test1@outlook.com',
        password: 'Pass1',
        refreshToken: 'Token11111111111111111111111111111111111111111',
      });
      expect(accounts[1]).toEqual({
        email: 'test2@outlook.com',
        password: 'Pass2',
      });
      expect(accounts[2]).toEqual({
        email: 'test3@outlook.com',
        password: 'Pass3',
      });
    });
  });

  describe('refreshGrokToken 请求调度', () => {
    it('成功刷新时返回包含新 access_token 与 refresh_token 的数据', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new_at_xyz',
          refresh_token: 'new_rt_abc',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });

      const res = await refreshGrokToken('old_rt_123', mockFetch as unknown as typeof fetch);
      expect(res.access_token).toBe('new_at_xyz');
      expect(res.refresh_token).toBe('new_rt_abc');
      expect(mockFetch).toHaveBeenCalledWith(
        XAI_AUTH_CONFIG.tokenEndpoint,
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('端点返回错误时正确抛出有意义的异常信息', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been revoked or expired',
        }),
      });

      await expect(
        refreshGrokToken('expired_rt', mockFetch as unknown as typeof fetch),
      ).rejects.toThrow('Token has been revoked or expired');
    });
  });
});
