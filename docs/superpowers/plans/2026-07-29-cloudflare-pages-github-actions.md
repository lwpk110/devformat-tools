# Cloudflare Pages GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 DevFormat.tools 建立由 GitHub Actions 驱动、通过完整质量门禁并发布 Cloudflare Pages Preview 与 Production 的自动交付流程。

**Architecture:** 新增独立 `deploy-pages.yml`，在任意 branch push 或手动触发时使用 Node.js 22 完成安装、测试、类型检查与 Astro 构建，再通过 Cloudflare Wrangler Action Direct Upload `dist/`。Cloudflare 控制台使用 GitHub OAuth 交互登录，Actions 使用 GitHub repository secrets 中的最小权限 Cloudflare API Token；Pages 项目只创建一次，后续 workflow 只负责部署。

**Tech Stack:** GitHub Actions、Cloudflare Pages、`cloudflare/wrangler-action@v3`、Wrangler 4、Node.js 22、Astro 4、Vitest、YAML、GitHub CLI、Cloudflare REST API

## Global Constraints

- 关联 GitHub Issue 固定为 `lwpk110/devformat-tools#3`，功能分支固定为 `feat/3-cloudflare-pages`。
- 不修改或接管现有 `https://devformat.tools/`，只使用 Cloudflare 免费 `*.pages.dev` 地址。
- Pages project name 固定为 `devformat-tools-lwpk110`；若真实创建时 Cloudflare 明确报告名称冲突，必须先同步修改设计、计划、workflow 与 Issue 后再继续。
- Production branch 固定为 `main`，构建输出固定为 `dist/`。
- GitHub Actions 权限只能是 `contents: read` 与 `deployments: write`。
- Cloudflare secret 名称固定为 `CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN`；token 权限固定为 `Account / Cloudflare Pages / Edit`。
- secret 不得写入仓库、测试、日志、Job Summary、Issue 或 PR。
- workflow 必须使用 Node.js 22 与 Wrangler 4，执行 `npm ci`、`npm test`、`npm run check`、`npm run build` 后才允许部署。
- 任意 branch push 触发部署：`main` 发布 Production，其他 branch 发布 Preview；同时支持 `workflow_dispatch`。
- 不新增 KV、D1、R2、Workers、DNS、自定义域名、Cloudflare Git Integration 或付费资源。
- 禁止直接向 `main` commit/push、force push、跳过 hooks 或重写已推送历史。

---

## File Structure

- `tests/unit/cloudflare-pages-workflow.test.ts`：解析并约束 workflow 的触发器、权限、质量命令、认证引用、部署命令和 URL 输出。
- `.github/workflows/deploy-pages.yml`：构建并 Direct Upload Cloudflare Pages，产生 Preview/Production GitHub Deployment。
- `docs/superpowers/specs/2026-07-29-cloudflare-pages-github-actions-design.md`：已确认的架构、认证和验收边界。
- `docs/superpowers/plans/2026-07-29-cloudflare-pages-github-actions.md`：本实施计划。

### Task 1: 以契约测试驱动 Cloudflare Pages workflow

**Files:**
- Create: `tests/unit/cloudflare-pages-workflow.test.ts`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `package-lock.json`、npm scripts `test`/`check`/`build`、GitHub secrets `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`、自动生成的 `GITHUB_TOKEN`
- Produces: GitHub workflow `Deploy Cloudflare Pages`；Wrangler deployment outputs `deployment-url` 与 `pages-deployment-alias-url`

- [ ] **Step 1: 编写失败的 workflow 契约测试**

创建 `tests/unit/cloudflare-pages-workflow.test.ts`：

```typescript
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number>;
}

interface DeployWorkflow {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency: {
    group: string;
    'cancel-in-progress': boolean;
  };
  jobs: {
    deploy: {
      'runs-on': string;
      'timeout-minutes': number;
      steps: WorkflowStep[];
    };
  };
}

const source = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
const workflow = parse(source) as DeployWorkflow;
const steps = workflow.jobs.deploy.steps;

describe('Cloudflare Pages workflow 契约', () => {
  it('支持任意 branch push 与手动部署，并按 ref 取消旧运行', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['push', 'workflow_dispatch']);
    expect(workflow.concurrency).toEqual({
      group: 'cloudflare-pages-${{ github.ref }}',
      'cancel-in-progress': true,
    });
  });

  it('只授予读取源码和写入 Deployment 的权限', () => {
    expect(workflow.permissions).toEqual({
      contents: 'read',
      deployments: 'write',
    });
  });

  it('使用 Node.js 22 和 npm cache 执行完整质量门禁', () => {
    const setupNode = steps.find((step) => step.uses === 'actions/setup-node@v4');
    expect(setupNode?.with).toEqual({
      'node-version': 22,
      cache: 'npm',
    });

    expect(steps.flatMap((step) => step.run ?? []).slice(0, 4)).toEqual([
      'npm ci',
      'npm test',
      'npm run check',
      'npm run build',
    ]);
  });

  it('使用固定 Pages 项目和约定 secrets 上传 dist', () => {
    const deploy = steps.find((step) => step.id === 'deploy');
    expect(deploy).toMatchObject({
      uses: 'cloudflare/wrangler-action@v3',
      with: {
        apiToken: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
        accountId: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
        wranglerVersion: '4',
        command: 'pages deploy dist --project-name=devformat-tools-lwpk110',
        gitHubToken: '${{ secrets.GITHUB_TOKEN }}',
      },
    });
  });

  it('只把部署 URL 写入 Job Summary', () => {
    const summary = steps.find((step) => step.name === 'Publish deployment URLs');
    expect(summary?.env).toEqual({
      DEPLOYMENT_URL: '${{ steps.deploy.outputs.deployment-url }}',
      DEPLOYMENT_ALIAS_URL: '${{ steps.deploy.outputs.pages-deployment-alias-url }}',
    });
    expect(summary?.run).toContain('$GITHUB_STEP_SUMMARY');
    expect(summary?.run).toContain('$DEPLOYMENT_URL');
    expect(summary?.run).toContain('$DEPLOYMENT_ALIAS_URL');
    expect(summary?.run).not.toMatch(/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)/);
  });

  it('workflow 源码不包含 Cloudflare 凭据字面量', () => {
    expect(source).not.toMatch(/apiToken:\s*(?!\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\})\S+/);
    expect(source).not.toMatch(/accountId:\s*(?!\$\{\{\s*secrets\.CLOUDFLARE_ACCOUNT_ID\s*\}\})\S+/);
  });
});
```

- [ ] **Step 2: 运行测试并确认因 workflow 缺失而失败**

Run:

```bash
npx vitest run tests/unit/cloudflare-pages-workflow.test.ts
```

Expected: FAIL，错误为 `ENOENT: no such file or directory, open '.github/workflows/deploy-pages.yml'`，证明测试命中尚未实现的交付文件，而不是 TypeScript 或 YAML 语法错误。

- [ ] **Step 3: 创建最小可部署 workflow**

创建 `.github/workflows/deploy-pages.yml`：

```yaml
name: Deploy Cloudflare Pages

on:
  push:
  workflow_dispatch:

permissions:
  contents: read
  deployments: write

concurrency:
  group: cloudflare-pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    name: Build and deploy
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Test
        run: npm test
      - name: Type check
        run: npm run check
      - name: Build
        run: npm run build
      - name: Deploy
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: "4"
          command: pages deploy dist --project-name=devformat-tools-lwpk110
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
      - name: Publish deployment URLs
        env:
          DEPLOYMENT_URL: ${{ steps.deploy.outputs.deployment-url }}
          DEPLOYMENT_ALIAS_URL: ${{ steps.deploy.outputs.pages-deployment-alias-url }}
        run: |
          {
            printf '### Cloudflare Pages\n\n'
            printf -- '- Deployment: %s\n' "$DEPLOYMENT_URL"
            printf -- '- Branch alias: %s\n' "$DEPLOYMENT_ALIAS_URL"
          } >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 4: 运行契约测试并确认通过**

Run:

```bash
npx vitest run tests/unit/cloudflare-pages-workflow.test.ts
```

Expected: PASS，6 个 workflow 契约用例全部通过。

- [ ] **Step 5: 运行本地完整质量门禁**

Run:

```bash
npm test
npm run check
npm run build
npm run verify:build
```

Expected: 四条命令全部以 exit code 0 完成；Vitest、Astro/TypeScript、静态构建与 `dist` 产物验证均通过。若现有性能微基准第一次失败，只允许单独重试一次；再次失败则停止提交并保留真实故障证据。

- [ ] **Step 6: 创建原子提交**

Run:

```bash
git add tests/unit/cloudflare-pages-workflow.test.ts .github/workflows/deploy-pages.yml
git diff --cached --check
git commit -m "feat: 添加 Cloudflare Pages 自动部署"
```

Expected: 新提交只包含 workflow 与其契约测试，不包含 token、构建产物或其他工作区改动。

### Task 2: 配置最小权限 Cloudflare 资源与 GitHub secrets

**Files:**
- External: Cloudflare account API token
- External: Cloudflare Pages project `devformat-tools-lwpk110`
- External: GitHub repository secrets `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`

**Interfaces:**
- Consumes: 维护者通过 GitHub OAuth 登录的 Cloudflare account；只具备 `Account / Cloudflare Pages / Edit` 的 API Token
- Produces: 可由 Actions 使用但无法读取明文的两个 GitHub secrets；Production branch 为 `main` 的 Direct Upload Pages project

- [ ] **Step 1: 由维护者使用 GitHub OAuth 登录并创建最小权限 Token**

打开以下官方页面：

```text
https://dash.cloudflare.com/?to=/:account/api-tokens
```

使用 GitHub OAuth 登录 Cloudflare，创建 Custom Token：名称 `devformat-tools-github-actions`，权限仅选择 `Account / Cloudflare Pages / Edit`，Account Resources 仅包含目标 account。不要把 token 粘贴到 Issue、PR、聊天或仓库文件。

- [ ] **Step 2: 在终端安全读取并验证 Token 与 Account ID**

Run:

```bash
read -rsp 'Cloudflare API Token: ' cloudflare_pages_api_token
printf '\n'
read -rp 'Cloudflare Account ID: ' cloudflare_pages_account_id
printf '%s' "$cloudflare_pages_account_id" | rg '^[a-f0-9]{32}$'
curl --fail --silent --show-error \
  --header "Authorization: Bearer ${cloudflare_pages_api_token}" \
  https://api.cloudflare.com/client/v4/user/tokens/verify |
  jq -e '.success == true and .result.status == "active"'
```

Expected: 命令不回显 token，Account ID 是 32 位小写十六进制字符串，Token verification 响应确认 token 为 active。

- [ ] **Step 3: 幂等创建 Direct Upload Pages project**

Run:

```bash
cloudflare_pages_project='devformat-tools-lwpk110'
cloudflare_project_status="$(curl --silent --output /tmp/devformat-cloudflare-project.json \
  --write-out '%{http_code}' \
  --header "Authorization: Bearer ${cloudflare_pages_api_token}" \
  "https://api.cloudflare.com/client/v4/accounts/${cloudflare_pages_account_id}/pages/projects/${cloudflare_pages_project}")"

if test "$cloudflare_project_status" = '404'; then
  curl --fail --silent --show-error \
    --request POST \
    --header "Authorization: Bearer ${cloudflare_pages_api_token}" \
    --header 'Content-Type: application/json' \
    --data '{"name":"devformat-tools-lwpk110","production_branch":"main"}' \
    "https://api.cloudflare.com/client/v4/accounts/${cloudflare_pages_account_id}/pages/projects" \
    > /tmp/devformat-cloudflare-project.json
elif test "$cloudflare_project_status" != '200'; then
  printf 'Cloudflare project query failed with HTTP %s\n' "$cloudflare_project_status" >&2
  exit 1
fi

jq -e '
  .success == true and
  .result.name == "devformat-tools-lwpk110" and
  .result.production_branch == "main"
' /tmp/devformat-cloudflare-project.json
```

Expected: project 存在或成功创建，API 响应确认名称为 `devformat-tools-lwpk110`、Production branch 为 `main`。若创建返回名称冲突，停止并按 Global Constraints 同步变更，不自动猜测新名称。

- [ ] **Step 4: 将凭据安全写入 GitHub repository secrets**

Run:

```bash
printf '%s' "$cloudflare_pages_account_id" |
  gh secret set CLOUDFLARE_ACCOUNT_ID --repo lwpk110/devformat-tools
printf '%s' "$cloudflare_pages_api_token" |
  gh secret set CLOUDFLARE_API_TOKEN --repo lwpk110/devformat-tools
unset cloudflare_pages_account_id cloudflare_pages_api_token
```

Expected: `gh` 成功写入两个 secret，终端不显示 secret 值。

- [ ] **Step 5: 验证资源和 secret 名称后清理临时响应**

Run:

```bash
gh secret list --repo lwpk110/devformat-tools --json name --jq '.[].name' |
  rg '^(CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN)$'
jq -r '[.result.name, .result.production_branch, .result.subdomain] | @tsv' \
  /tmp/devformat-cloudflare-project.json
rm /tmp/devformat-cloudflare-project.json
```

Expected: 两个 secret 名称各出现一次；Cloudflare project 输出名称、`main` 和非空 `pages.dev` subdomain。删除的临时文件只包含 Cloudflare project metadata，不包含 token，可通过重新调用 API 恢复。

### Task 3: Push、Preview、PR review 与 Production 闭环

**Files:**
- External: Git branch `feat/3-cloudflare-pages`
- External: GitHub PR targeting `main`
- External: GitHub Actions Preview/Production runs and Deployments
- External: Cloudflare Pages Preview/Production deployments

**Interfaces:**
- Consumes: 已提交的设计与计划、Task 1 的 workflow 实现提交、Task 2 的 Pages project 与 GitHub secrets、Issue #3
- Produces: 可访问的 Preview URL、完成 Copilot review 与 CI 的 squash-merged PR、可访问的 Production `pages.dev` URL

- [ ] **Step 1: Push 功能分支并创建 Draft PR**

Run:

```bash
git status --short
git push --set-upstream origin feat/3-cloudflare-pages
gh pr create \
  --repo lwpk110/devformat-tools \
  --base main \
  --head feat/3-cloudflare-pages \
  --draft \
  --title 'feat: 使用 GitHub Actions 部署 Cloudflare Pages' \
  --body $'## Why\n\n通过 GitHub Actions 对每次 branch push 执行完整质量门禁，并把 Astro 静态产物 Direct Upload 到 Cloudflare Pages。\n\nCloses #3\n\n## What Changed\n\n- 新增 Cloudflare Pages workflow 契约测试\n- 新增 Preview 与 Production 部署 workflow\n- 使用最小权限 Cloudflare secrets 和 GitHub Deployment\n\n## Risk\n\n- 不修改现有 devformat.tools，只发布 pages.dev\n- Cloudflare token 仅具备 Pages Edit 权限且不进入仓库\n\n## Verification\n\n- [x] npm test\n- [x] npm run check\n- [x] npm run build\n- [x] npm run verify:build\n- [ ] Preview deployment 可访问\n- [ ] Copilot review 完成\n- [ ] Production deployment 可访问'
```

Expected: 分支 push 成功并返回唯一 Draft PR URL；不得 force push，不得创建第二个同分支 PR。

- [ ] **Step 2: 等待 Preview workflow 并提取可访问 URL**

Run:

```bash
preview_run_id=''
for preview_poll_attempt in $(seq 1 12); do
  preview_run_id="$(gh run list \
    --repo lwpk110/devformat-tools \
    --workflow deploy-pages.yml \
    --branch feat/3-cloudflare-pages \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId // empty')"
  test -n "$preview_run_id" && break
  sleep 5
done
test -n "$preview_run_id"
gh run watch "$preview_run_id" --repo lwpk110/devformat-tools --exit-status

preview_deployment_id="$(gh api \
  'repos/lwpk110/devformat-tools/deployments?ref=feat%2F3-cloudflare-pages&per_page=10' \
  --jq 'map(select(.environment | test("cloudflare|preview"; "i")))[0].id // .[0].id')"
preview_url="$(gh api \
  "repos/lwpk110/devformat-tools/deployments/${preview_deployment_id}/statuses" \
  --jq 'map(select(.state == "success" and .environment_url != null))[0].environment_url')"
test -n "$preview_url"
printf '%s\n' "$preview_url"
```

Expected: Preview run conclusion 为 success，`preview_url` 是 Cloudflare HTTPS URL。

- [ ] **Step 3: 对 Preview 执行真实 HTTP smoke 验证**

Run:

```bash
for preview_path in / /convert/base64/ /robots.txt /sitemap-index.xml; do
  preview_status="$(curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' "${preview_url%/}${preview_path}")"
  test "$preview_status" = '200'
done
curl --fail --silent --show-error "$preview_url" | rg '<title>DevFormat.tools'
```

Expected: 四个 URL 均返回 HTTP 200，首页 HTML 包含本仓库的 `DevFormat.tools` title。

- [ ] **Step 4: 更新 PR 为 Ready 并请求 Copilot review**

Run:

```bash
cloudflare_pr_number="$(gh pr view \
  --repo lwpk110/devformat-tools \
  --json number \
  --jq '.number')"
gh pr ready "$cloudflare_pr_number" --repo lwpk110/devformat-tools
```

随后调用 GitHub MCP `request_copilot_review`，`owner` 传 `lwpk110`、`repo` 传 `devformat-tools`，并把 `cloudflare_pr_number` 转为整数后原样传入 `pullNumber`。不允许使用普通 `@copilot` 评论代替正式 review 请求。

Expected: PR 不再是 Draft，Copilot review request 已创建。

- [ ] **Step 5: 审核 CI、Copilot feedback、冲突与 secret scanning**

Run:

```bash
gh pr checks "$cloudflare_pr_number" --repo lwpk110/devformat-tools --watch
gh pr view "$cloudflare_pr_number" \
  --repo lwpk110/devformat-tools \
  --json isDraft,mergeable,mergeStateStatus,reviews,statusCheckRollup
gh api "repos/lwpk110/devformat-tools/secret-scanning/alerts?state=open" \
  --jq 'map(select(.resolution == null)) | length'
```

Expected: PR Ready、mergeable、所有 checks success、Copilot review 已完成且无有效 unresolved feedback、secret scanning 新增阻塞项为 0。若 secret scanning API 因仓库许可返回 404，运行以下本地降级检查并在 PR 中记录降级：

```bash
git diff origin/main...HEAD -- . ':!package-lock.json' |
  rg -n '(CLOUDFLARE_API_TOKEN|Bearer [A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----)' && exit 1 || true
```

- [ ] **Step 6: Squash merge 并等待 Production workflow**

Run:

```bash
gh pr merge "$cloudflare_pr_number" \
  --repo lwpk110/devformat-tools \
  --squash \
  --delete-branch \
  --subject 'feat: 使用 GitHub Actions 部署 Cloudflare Pages'

production_run_id=''
for production_poll_attempt in $(seq 1 12); do
  production_run_id="$(gh run list \
    --repo lwpk110/devformat-tools \
    --workflow deploy-pages.yml \
    --branch main \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId // empty')"
  test -n "$production_run_id" && break
  sleep 5
done
test -n "$production_run_id"
gh run watch "$production_run_id" --repo lwpk110/devformat-tools --exit-status
```

Expected: PR 以 squash 合并、远端功能分支删除，`main` 的 Production workflow conclusion 为 success。

- [ ] **Step 7: 提取并验证 Production URL**

Run:

```bash
production_deployment_id="$(gh api \
  'repos/lwpk110/devformat-tools/deployments?ref=main&per_page=10' \
  --jq 'map(select(.environment | test("cloudflare|production"; "i")))[0].id // .[0].id')"
production_url="$(gh api \
  "repos/lwpk110/devformat-tools/deployments/${production_deployment_id}/statuses" \
  --jq 'map(select(.state == "success" and .environment_url != null))[0].environment_url')"
test -n "$production_url"

for production_path in / /convert/base64/ /robots.txt /sitemap-index.xml; do
  production_status="$(curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' "${production_url%/}${production_path}")"
  test "$production_status" = '200'
done
printf '%s\n' "$production_url"
```

Expected: Production URL 是可访问的 Cloudflare HTTPS `pages.dev` 地址，四个路径均返回 HTTP 200。

- [ ] **Step 8: 完成 Issue 与本地同步审计**

Run:

```bash
gh issue view 3 --repo lwpk110/devformat-tools --json state,url
gh pr view "$cloudflare_pr_number" --repo lwpk110/devformat-tools --json state,mergedAt,mergeCommit,url
git fetch origin main
git ls-remote --exit-code --heads origin feat/3-cloudflare-pages && exit 1 || true
```

Expected: Issue #3 因 `Closes #3` 为 CLOSED，PR 为 MERGED 且有 merge commit，远端功能分支不存在。保留隔离 worktree 直至确认主工作区 Agent Harness 在途改动已安全处理；不得在主工作区强制切分支或覆盖其文件。
