# Cloudflare Pages 幂等初始化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让现有 Cloudflare Pages 部署 workflow 在完整质量门禁通过后自动、幂等创建或验证 `devformat-tools` Pages project，并继续完成 Preview 与 Production 交付。

**Architecture:** 新增一个由 Node.js 22 直接执行的 `.github/scripts/ensure-pages-project.mjs`，把 Cloudflare REST API 状态机与 YAML 编排分离。workflow 只负责注入既有 secrets 和固定资源配置；初始化器通过可注入的 `fetch` 实现查询、创建、并发冲突重查与响应契约验证，Vitest 在无真实网络和无真实凭据的条件下覆盖行为。

**Tech Stack:** GitHub Actions、Node.js 22 ESM、Cloudflare REST API、Cloudflare Pages、Wrangler 4、Vitest、TypeScript、YAML

## Global Constraints

- 关联 GitHub Issue 固定为 `lwpk110/devformat-tools#3`，功能分支固定为 `feat/3-cloudflare-pages`，复用 Draft PR #5。
- 本计划补充并取代原计划中由维护者在本地创建 Pages project 的步骤；已配置的 GitHub repository secrets 保持不变。
- Pages project name 固定为 `devformat-tools`，Production branch 固定为 `main`；冲突时停止，不猜测新名称。
- 只有 `npm ci`、`npm run check`、`npm run build`、`npm test` 全部成功后才允许调用 Cloudflare API。
- Cloudflare API Token 权限保持 `Account / Cloudflare Pages / Edit`，不得新增 DNS、Workers 或其他权限。
- GitHub workflow 权限保持 `contents: read` 与 `deployments: write`。
- 不修改或删除同名 Worker，不修改 `devformat.tools` DNS，不新增自定义域名或付费资源。
- Token、Account ID 与 Cloudflare API response body 不得写入源码、测试输出、Actions 日志或 Job Summary。
- 禁止直接向 `main` commit/push、force push、跳过 hooks 或重写已推送历史。

---

## File Structure

- `.github/scripts/ensure-pages-project.mjs`：唯一负责 Cloudflare Pages project 查询、创建、并发冲突重查、配置验证与脱敏错误的初始化器。
- `tests/unit/ensure-pages-project.test.ts`：通过可注入 `fetch` stub 验证初始化器的 REST 状态机和敏感信息边界。
- `.github/workflows/deploy-pages.yml`：在测试之后、Wrangler 部署之前调用初始化器，只传入固定配置与 GitHub secrets。
- `tests/unit/cloudflare-pages-workflow.test.ts`：约束初始化 step 的顺序、命令和 env，不重复测试 REST 状态机。
- `docs/superpowers/plans/2026-07-29-cloudflare-pages-idempotent-bootstrap.md`：本实施计划。

### Task 1: 以 TDD 实现并接入 Pages project 初始化器

**Files:**
- Create: `.github/scripts/ensure-pages-project.mjs`
- Create: `tests/unit/ensure-pages-project.test.ts`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `tests/unit/cloudflare-pages-workflow.test.ts`

**Interfaces:**
- Consumes: `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_PAGES_PROJECT`、`CLOUDFLARE_PAGES_PRODUCTION_BRANCH` 环境变量；Cloudflare API `GET/POST /accounts/{account}/pages/projects`
- Produces: `ensurePagesProject(config, { fetchImpl }) => Promise<{ state, project }>`；验证通过的 Pages project；供 Wrangler 部署使用的 workflow 前置条件

- [ ] **Step 1: 写入初始化器存在性测试并验证第一个 RED**

创建 `tests/unit/ensure-pages-project.test.ts`：

```typescript
import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Cloudflare Pages project 初始化器', () => {
  it('提供可由 Node.js 22 执行的 ESM 模块', () => {
    expect(existsSync('.github/scripts/ensure-pages-project.mjs')).toBe(true);
  });
});
```

Run:

```bash
npx vitest run tests/unit/ensure-pages-project.test.ts
```

Expected: FAIL，`existsSync(...)` 实际为 `false`；失败原因仅是初始化器尚不存在。

- [ ] **Step 2: 创建最小模块骨架并验证第一个 GREEN**

创建 `.github/scripts/ensure-pages-project.mjs`：

```javascript
export async function ensurePagesProject() {
  throw new Error('Pages project initializer is not implemented');
}

export async function runFromEnvironment() {
  return ensurePagesProject();
}
```

Run:

```bash
npx vitest run tests/unit/ensure-pages-project.test.ts
```

Expected: PASS，1/1；此时模块存在但行为仍未实现。

- [ ] **Step 3: 用完整行为测试制造第二个 RED**

将 `tests/unit/ensure-pages-project.test.ts` 替换为：

```typescript
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

  it('错误信息不包含 Token 或 Account ID', async () => {
    const apiBodyMarker = 'sensitive-api-response-for-test';
    const stub = createFetchStub([
      new Response(apiBodyMarker, { status: 403 }),
    ]);

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
```

Run:

```bash
npx vitest run tests/unit/ensure-pages-project.test.ts
```

Expected: FAIL，行为用例收到 `Pages project initializer is not implemented`；存在性用例仍通过。

- [ ] **Step 4: 实现最小 REST 状态机并验证第二个 GREEN**

将 `.github/scripts/ensure-pages-project.mjs` 替换为：

```javascript
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.cloudflare.com/client/v4';

function requiredEnvironment(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requestHeaders(apiToken, includeJson = false) {
  return {
    authorization: `Bearer ${apiToken}`,
    ...(includeJson ? { 'content-type': 'application/json' } : {}),
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`Cloudflare API returned invalid JSON with HTTP ${response.status}`);
  }
}

function validateProject(payload, projectName, productionBranch) {
  const project = payload?.result;
  if (
    payload?.success !== true ||
    project?.name !== projectName ||
    project?.production_branch !== productionBranch
  ) {
    throw new Error('Cloudflare Pages project does not match expected configuration');
  }
  return project;
}

async function queryProject(collectionUrl, projectName, apiToken, fetchImpl) {
  return fetchImpl(`${collectionUrl}/${encodeURIComponent(projectName)}`, {
    headers: requestHeaders(apiToken),
  });
}

export async function ensurePagesProject(config, { fetchImpl = fetch } = {}) {
  const { accountId, apiToken, projectName, productionBranch } = config;
  const collectionUrl = `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/pages/projects`;
  const query = await queryProject(collectionUrl, projectName, apiToken, fetchImpl);

  if (query.status === 200) {
    return {
      state: 'existing',
      project: validateProject(await readJson(query), projectName, productionBranch),
    };
  }
  if (query.status !== 404) {
    throw new Error(`Cloudflare Pages project query failed with HTTP ${query.status}`);
  }

  const create = await fetchImpl(collectionUrl, {
    method: 'POST',
    headers: requestHeaders(apiToken, true),
    body: JSON.stringify({ name: projectName, production_branch: productionBranch }),
  });
  if (create.ok) {
    return {
      state: 'created',
      project: validateProject(await readJson(create), projectName, productionBranch),
    };
  }
  if (create.status !== 409) {
    throw new Error(`Cloudflare Pages project creation failed with HTTP ${create.status}`);
  }

  // 首次多分支部署可能同时观察到 404；仅并发冲突时重查，不覆盖资源。
  const afterCreate = await queryProject(collectionUrl, projectName, apiToken, fetchImpl);
  if (afterCreate.status === 200) {
    return {
      state: 'existing-after-race',
      project: validateProject(
        await readJson(afterCreate),
        projectName,
        productionBranch,
      ),
    };
  }
  throw new Error(
    `Cloudflare Pages project race query failed with HTTP ${afterCreate.status}`,
  );
}

export async function runFromEnvironment(env = process.env, fetchImpl = fetch) {
  return ensurePagesProject(
    {
      accountId: requiredEnvironment(env, 'CLOUDFLARE_ACCOUNT_ID'),
      apiToken: requiredEnvironment(env, 'CLOUDFLARE_API_TOKEN'),
      projectName: requiredEnvironment(env, 'CLOUDFLARE_PAGES_PROJECT'),
      productionBranch: requiredEnvironment(
        env,
        'CLOUDFLARE_PAGES_PRODUCTION_BRANCH',
      ),
    },
    { fetchImpl },
  );
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  runFromEnvironment()
    .then(({ state, project }) => {
      console.log(`Cloudflare Pages project ready: ${project.name} (${state})`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Cloudflare Pages initialization failed');
      process.exitCode = 1;
    });
}
```

Run:

```bash
npx vitest run tests/unit/ensure-pages-project.test.ts
```

Expected: PASS，7/7；测试不访问网络，不包含真实 Cloudflare 凭据。

- [ ] **Step 5: 写入 workflow 集成测试并验证第三个 RED**

在 `tests/unit/cloudflare-pages-workflow.test.ts` 的 `describe` 中、部署契约用例之前增加：

```typescript
  it('质量门禁后初始化 Pages project，再执行 Wrangler 部署', () => {
    const initializeIndex = steps.findIndex(
      (step) => step.name === 'Ensure Cloudflare Pages project',
    );
    const testIndex = steps.findIndex((step) => step.run === 'npm test');
    const deployIndex = steps.findIndex((step) => step.id === 'deploy');
    const initialize = steps[initializeIndex];

    expect(initialize).toEqual({
      name: 'Ensure Cloudflare Pages project',
      env: {
        CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
        CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
        CLOUDFLARE_PAGES_PROJECT: 'devformat-tools',
        CLOUDFLARE_PAGES_PRODUCTION_BRANCH: 'main',
      },
      run: 'node .github/scripts/ensure-pages-project.mjs',
    });
    expect(initializeIndex).toBeGreaterThan(testIndex);
    expect(deployIndex).toBeGreaterThan(initializeIndex);
  });
```

Run:

```bash
npx vitest run tests/unit/cloudflare-pages-workflow.test.ts
```

Expected: FAIL，`initializeIndex` 为 `-1`，证明 workflow 尚未调用初始化器。

- [ ] **Step 6: 最小接入 workflow 并验证第三个 GREEN**

在 `.github/workflows/deploy-pages.yml` 的 `Test` 与 `Deploy` steps 之间增加：

```yaml
      - name: Ensure Cloudflare Pages project
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_PAGES_PROJECT: devformat-tools
          CLOUDFLARE_PAGES_PRODUCTION_BRANCH: main
        run: node .github/scripts/ensure-pages-project.mjs
```

Run:

```bash
npx vitest run tests/unit/ensure-pages-project.test.ts tests/unit/cloudflare-pages-workflow.test.ts
```

Expected: PASS，初始化器 7/7、workflow 契约 7/7。

- [ ] **Step 7: 执行完整质量与敏感信息门禁**

Run:

```bash
npm run check
npm run build
npm test
npm run verify:build
git diff --check
git diff origin/main...HEAD -- . ':!package-lock.json' |
  rg -n 'Bearer [A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----' && exit 1 || true
```

Expected: check 为 0 errors/warnings，build 生成 10 个页面，全部 Vitest 与 build 验证通过，diff 无空白错误或真实 secret。现有性能微基准首次失败时只允许单独重试一次；再次失败停止提交。

- [ ] **Step 8: 创建原子提交并 push 当前功能分支**

Run:

```bash
git add \
  .github/scripts/ensure-pages-project.mjs \
  .github/workflows/deploy-pages.yml \
  tests/unit/ensure-pages-project.test.ts \
  tests/unit/cloudflare-pages-workflow.test.ts
git diff --cached --check
git commit -m "feat(ci): 自动初始化 Cloudflare Pages 项目"
git push origin feat/3-cloudflare-pages
```

Expected: 单一提交只包含初始化器、直接测试、workflow 集成与契约测试；push 不使用 force，并触发标准 CI 与 Pages Preview workflow。

### Task 2: Preview、review、合并与 Production 闭环

**Files:**
- External: GitHub PR #5、Issue #3、Actions runs、Deployments
- External: Cloudflare Pages project `devformat-tools`、Preview 与 Production deployments

**Interfaces:**
- Consumes: Task 1 的已推送 commit、已配置 repository secrets、Draft PR #5
- Produces: 可访问 Preview URL、Ready PR、Copilot review、squash merge、可访问 Production URL、关闭的 Issue #3

- [ ] **Step 1: 等待两套 CI 并提取真实 Preview URL**

Run:

```bash
preview_head_sha="$(git rev-parse HEAD)"
preview_deploy_run_id="$(gh run list \
  --repo lwpk110/devformat-tools \
  --workflow deploy-pages.yml \
  --commit "$preview_head_sha" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
preview_ci_run_id="$(gh run list \
  --repo lwpk110/devformat-tools \
  --workflow ci.yml \
  --commit "$preview_head_sha" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
test -n "$preview_deploy_run_id"
test -n "$preview_ci_run_id"
gh run watch "$preview_deploy_run_id" --repo lwpk110/devformat-tools --exit-status
gh run watch "$preview_ci_run_id" --repo lwpk110/devformat-tools --exit-status
preview_url="$(gh run view "$preview_deploy_run_id" \
  --repo lwpk110/devformat-tools \
  --log |
  rg -o 'https://[a-z0-9.-]+\.pages\.dev' |
  sort -u |
  head -n 1)"
test -n "$preview_url"
printf '%s\n' "$preview_url"
```

Expected: 标准 CI 与 `Deploy Cloudflare Pages` 都为 success；部署日志显示项目为 existing 或 created，输出唯一 deployment URL 与 branch alias URL，不出现 Token、Account ID 或 API body。

- [ ] **Step 2: 验证 Preview 页面、SEO 资源与 GitHub Deployment**

Run:

```bash
preview_head_sha="$(git rev-parse HEAD)"
preview_deploy_run_id="$(gh run list \
  --repo lwpk110/devformat-tools \
  --workflow deploy-pages.yml \
  --commit "$preview_head_sha" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
preview_url="$(gh run view "$preview_deploy_run_id" \
  --repo lwpk110/devformat-tools \
  --log |
  rg -o 'https://[a-z0-9.-]+\.pages\.dev' |
  sort -u |
  head -n 1)"
test -n "$preview_url"
for preview_path in / /convert/base64/ /robots.txt /sitemap-index.xml; do
  curl --fail --silent --show-error --location \
    --output /dev/null \
    --write-out "${preview_path} %{http_code}\n" \
    "${preview_url%/}${preview_path}"
done
gh api repos/lwpk110/devformat-tools/deployments \
  --jq '.[] | select(.ref == "feat/3-cloudflare-pages") | [.sha, .environment, .statuses_url] | @tsv'
```

Expected: 四个路径最终均为 HTTP 200；Deployment SHA 等于 PR head SHA，环境与 Preview 对应。

- [ ] **Step 3: 更新 PR、转 Ready 并请求 Copilot review**

使用 GitHub MCP `update_pull_request` 更新 PR #5 正文中的 Preview URL 与验证清单，并设置 `draft: false`。随后调用 GitHub MCP `request_copilot_review`：

```text
owner: lwpk110
repo: devformat-tools
pullNumber: 5
```

Expected: PR #5 为 Ready，正文记录真实 Preview 证据，正式 Copilot review request 已创建；不使用普通评论代替。

- [ ] **Step 4: 验证 review、checks、冲突与 secret scanning**

Run:

```bash
gh pr view 5 \
  --repo lwpk110/devformat-tools \
  --json isDraft,mergeable,mergeStateStatus,reviews,statusCheckRollup
gh api repos/lwpk110/devformat-tools/secret-scanning/alerts?state=open \
  --jq 'map(select(.resolution == null)) | length'
```

同时使用 GitHub MCP `pull_request_read` 的 `get_reviews` 与 `get_review_comments` 检查 requested changes 和 unresolved threads。

Expected: PR Ready、mergeable、所有 checks success、Copilot review 完成且无有效 unresolved feedback。若 secret scanning 因私有仓库许可不可用，使用 Task 1 Step 7 的本地 diff 扫描作为明确记录的降级证据。

- [ ] **Step 5: Squash merge 并等待 Production workflow**

仅在 Step 4 全部满足后，使用 GitHub MCP `merge_pull_request`：

```text
owner: lwpk110
repo: devformat-tools
pullNumber: 5
merge_method: squash
commit_title: feat: 添加 Cloudflare Pages 自动部署
```

Expected: PR merged，Issue #3 因 `Closes #3` 自动关闭，远端功能分支删除；`main` push 触发标准 CI 与 Pages Production workflow。

- [ ] **Step 6: 验证 Production 并完成交付审计**

Run:

```bash
production_url='https://devformat-tools.pages.dev'
for production_path in / /convert/base64/ /robots.txt /sitemap-index.xml; do
  curl --fail --silent --show-error --location \
    --output /dev/null \
    --write-out "${production_path} %{http_code}\n" \
    "${production_url}${production_path}"
done
gh run list --repo lwpk110/devformat-tools --branch main --limit 5 \
  --json databaseId,name,status,conclusion,url,headSha
gh pr view 5 --repo lwpk110/devformat-tools --json state,mergedAt,mergeCommit,url
gh issue view 3 --repo lwpk110/devformat-tools --json state,url
```

Expected: Production 四个路径均 HTTP 200；`main` 的标准 CI 与 Pages workflow success；PR #5 merged，Issue #3 closed，merge commit 与 Production Deployment SHA 对应。完成逐项审计后才允许将 active goal 标记 complete。
