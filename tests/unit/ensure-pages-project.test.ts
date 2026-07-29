import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface Project {
  name: string;
  production_branch: string;
  subdomain?: string;
}

interface EnsureConfig {
  accountId: string;
  apiToken: string;
  projectName: string;
  productionBranch: string;
}

interface EnsureModule {
  ensurePagesProject(
    config: EnsureConfig,
    options: { fetchImpl: FetchLike },
  ): Promise<{ state: string; project: Project }>;
  runFromEnvironment(
    env: NodeJS.ProcessEnv,
    fetchImpl: FetchLike,
  ): Promise<{ state: string; project: Project }>;
}

const moduleUrl = pathToFileURL(
  resolve('.github/scripts/ensure-pages-project.mjs'),
).href;
const { ensurePagesProject, runFromEnvironment } = (await import(moduleUrl)) as EnsureModule;

const config: EnsureConfig = {
  accountId: 'account-for-test',
  apiToken: 'token-for-test',
  projectName: 'devformat-tools',
  productionBranch: 'main',
};

function apiResponse(status: number, result?: Partial<Project>): Response {
  return new Response(
    JSON.stringify({
      success: status >= 200 && status < 300,
      result,
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

function createFetchStub(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const queue = [...responses];
  const fetchImpl: FetchLike = async (input, init) => {
    const response = queue.shift();
    if (!response) throw new Error('Unexpected fetch call');
    calls.push({ url: String(input), init });
    return response;
  };
  return { calls, fetchImpl };
}

describe('Cloudflare Pages project 初始化器', () => {
  it('提供可由 Node.js 22 执行的 ESM 模块', () => {
    expect(existsSync('.github/scripts/ensure-pages-project.mjs')).toBe(true);
  });

  it('复用名称和 Production branch 都正确的现有项目', async () => {
    const stub = createFetchStub([
      apiResponse(200, { name: 'devformat-tools', production_branch: 'main' }),
    ]);

    const result = await ensurePagesProject(config, { fetchImpl: stub.fetchImpl });

    expect(result.state).toBe('existing');
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.init?.method).toBeUndefined();
  });

  it('查询返回 404 时创建固定项目', async () => {
    const stub = createFetchStub([
      apiResponse(404),
      apiResponse(200, { name: 'devformat-tools', production_branch: 'main' }),
    ]);

    const result = await ensurePagesProject(config, { fetchImpl: stub.fetchImpl });

    expect(result.state).toBe('created');
    expect(stub.calls[1]?.init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'devformat-tools', production_branch: 'main' }),
    });
  });

  it('并发创建失败后重新查询并复用最终项目', async () => {
    const stub = createFetchStub([
      apiResponse(404),
      apiResponse(409),
      apiResponse(200, { name: 'devformat-tools', production_branch: 'main' }),
    ]);

    const result = await ensurePagesProject(config, { fetchImpl: stub.fetchImpl });

    expect(result.state).toBe('existing-after-race');
    expect(stub.calls).toHaveLength(3);
  });

  it('拒绝 Production branch 漂移的现有项目', async () => {
    const stub = createFetchStub([
      apiResponse(200, { name: 'devformat-tools', production_branch: 'production' }),
    ]);

    await expect(
      ensurePagesProject(config, { fetchImpl: stub.fetchImpl }),
    ).rejects.toThrow('does not match expected configuration');
  });

  it('错误信息不包含 Token、Account ID 或 API body', async () => {
    const apiBodyMarker = 'sensitive-api-response-for-test';
    const stub = createFetchStub([new Response(apiBodyMarker, { status: 403 })]);

    const error = await ensurePagesProject(config, {
      fetchImpl: stub.fetchImpl,
    }).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(config.apiToken);
    expect((error as Error).message).not.toContain(config.accountId);
    expect((error as Error).message).not.toContain(apiBodyMarker);
  });

  it('缺少必需环境变量时不调用 Cloudflare', async () => {
    const stub = createFetchStub([]);

    await expect(runFromEnvironment({}, stub.fetchImpl)).rejects.toThrow(
      'Missing required environment variable: CLOUDFLARE_ACCOUNT_ID',
    );
    expect(stub.calls).toHaveLength(0);
  });
});
