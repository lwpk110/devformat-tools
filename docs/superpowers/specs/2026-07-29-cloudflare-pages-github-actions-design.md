# Cloudflare Pages GitHub Actions 交付设计

日期：2026-07-29
关联 Issue：[GitHub #3](https://github.com/lwpk110/devformat-tools/issues/3)

## 背景与目标

DevFormat.tools 是 Astro 静态站点，构建产物位于 `dist/`。本次为项目增加 GitHub CI/CD workflow：功能分支 push 后生成可访问的 Cloudflare Pages Preview，`main` push 后发布 Production。初始部署只使用 Cloudflare 免费的 `*.pages.dev` 临时域名，不修改现有 `devformat.tools`。

当前 `https://devformat.tools/` 已承载另一套线上站点，内容与本仓库不同，因此自定义域名接管明确排除在本次范围外。

## 方案比较

### 方案 A：GitHub Actions + Pages Direct Upload（采用）

GitHub Actions 自行执行测试、构建并通过 Wrangler 上传预构建的 `dist/`。优点是 CI/CD 逻辑完全版本化在仓库内，Preview 与 Production 使用同一产物和同一质量门禁，符合用户对 GitHub workflow 的明确要求。代价是需要在 GitHub secrets 中保存 Cloudflare Account ID 与最小权限 API Token。

### 方案 B：Cloudflare Pages Git Integration

通过 Cloudflare GitHub App 连接仓库，由 Cloudflare 自动构建和部署。该方案能使用 GitHub OAuth 完成仓库授权，但部署流程不由 GitHub Actions 执行；Cloudflare 还明确说明 Git-integrated project 不能直接切换为 Direct Upload，因此不采用。

### 方案 C：GitHub OIDC 临时身份

用 GitHub OIDC 换取短期部署凭据可避免长期 token，但 Cloudflare Pages/Wrangler 当前官方 GitHub Actions 流程仍要求 API Token，没有只凭 GitHub OAuth 完成无人值守部署的受支持路径，因此不采用。

## 认证边界

- 维护者在 Cloudflare 控制台使用 GitHub OAuth 登录或注册账号。
- GitHub OAuth 只用于交互式控制台身份，不能直接传递给无人值守的 GitHub Actions。
- GitHub Actions 使用 repository secrets：`CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN`。
- API Token 只授予 `Account / Cloudflare Pages / Edit`，不授予 DNS、域名或其他账户写权限。
- secret 不写入仓库、测试、命令参数日志或 Job Summary。
- GitHub 自动生成的 `GITHUB_TOKEN` 只用于创建 GitHub Deployment，workflow 权限限制为 `contents: read` 与 `deployments: write`。

## Cloudflare 资源

- Pages project name：`devformat-tools`。
- Production branch：`main`。
- Build output：`dist/`。
- 预期 Production URL：`https://devformat-tools.pages.dev/`；只有 Cloudflare API 成功创建同名 Pages project 后才把该地址视为有效资源。
- Preview：Wrangler 根据非 `main` Git branch 创建 Preview deployment，并返回唯一 deployment URL 与 branch alias URL。
- 本次不新增 KV、D1、R2、Workers、域名、DNS 记录或付费资源。

Pages project 是部署前唯一需要创建的 Cloudflare 资源。Cloudflare account 中已有名为 `devformat-tools` 的 Worker，但 Pages API 返回项目不存在；Worker 不作为 Pages project 使用，也不由本 workflow 修改。经用户批准，GitHub Actions 使用既有最小权限 Token 幂等查询或创建同名 Direct Upload Pages project。

## Workflow 架构

新建 `.github/workflows/deploy-pages.yml`，不修改现有 CI workflow，以避免与仓库治理工作的在途改动耦合。

触发器：

- 任意 branch 的 `push`：功能分支生成 Preview，`main` 生成 Production。
- `workflow_dispatch`：允许维护者手动重试当前分支部署。

同一 ref 的新运行取消旧运行，避免过期构建晚于新提交上线。部署 job 使用 Ubuntu runner 和 Node.js 22，以兼容当前 Wrangler 4 的 Node.js 要求。

执行顺序固定为：

```text
checkout
→ setup Node.js 22 + npm cache
→ npm ci
→ npm run check
→ npm run build
→ npm test
→ 查询或创建 Cloudflare Pages project
→ cloudflare/wrangler-action@v3 pages deploy dist
→ 写入无敏感信息的部署 URL 到 Job Summary
```

项目初始化步骤仅在完整质量门禁通过后运行。它通过 Cloudflare REST API 查询固定 Pages project：HTTP 200 时验证名称和 Production branch；HTTP 404 时创建 `devformat-tools`，Production branch 固定为 `main`；并发创建返回冲突时重新查询并验证最终资源；其他 HTTP 状态或响应契约不匹配时立即失败。API 响应仅在进程内存中解析，不落盘，也不输出 response body、Token 或 Account ID。

随后部署步骤向 Wrangler Action 传入两个 Cloudflare secrets、GitHub 自动 token、`dist` 和固定 Pages project name。Wrangler 从 Git metadata 识别当前 branch；workflow 不拼接未经处理的 branch 名到 shell 命令。

## 数据流与发布语义

1. 开发者 push 功能分支。
2. GitHub Actions 从该 commit 安装锁定依赖并执行完整质量门禁。
3. 门禁失败时 workflow 终止，不调用 Cloudflare。
4. 门禁通过后，workflow 查询 Pages project；不存在时创建，存在时验证其 Production branch 为 `main`。
5. Wrangler 上传同一次运行生成的 `dist/`。
6. Cloudflare 返回 deployment URL；Wrangler Action 创建 GitHub Deployment 并输出 URL。
7. workflow 将 deployment URL 写入 Job Summary，便于直接访问 Preview。
8. 功能分支后续 push 替换该 branch 的最新 Preview；唯一 commit deployment URL 仍可追溯。
9. `main` push 使用 Pages project 的 Production branch 配置发布 Production。

## 错误处理

- 缺失 Account ID 或 API Token：部署步骤失败，不降级为匿名上传，也不跳过质量门禁。
- Token 权限不足：保留 Actions 日志中的 Cloudflare 错误码，但不打印 token；修正权限后使用 `workflow_dispatch` 重试。
- Pages project 不存在：初始化步骤使用 Cloudflare REST API 创建；创建失败时停止，不执行 Wrangler 上传。
- Pages project 已存在但 Production branch 不是 `main`：停止部署，不隐式修改既有资源配置。
- 多分支首次部署并发创建：创建冲突的一方重新查询并验证最终资源，验证失败时停止。
- Pages project name 冲突：停止自动创建，不猜测新名称；确认唯一名称后同步修改 workflow、GitHub Issue 与本文档。
- 质量测试疑似 flaky：最多重试一次；再次失败按真实故障处理，不强行部署。
- Cloudflare 上传失败：Production 保持上一成功版本，Preview 不更新；不修改 DNS 或现有 `devformat.tools`。
- 同分支并发部署：由 GitHub concurrency 取消较旧运行。

## 测试与验收

新增独立的 Vitest workflow 契约测试，解析 `.github/workflows/deploy-pages.yml` 并验证：

- 触发任意 branch push 与手动运行；
- 权限只有 `contents: read`、`deployments: write`；
- concurrency 按 ref 隔离且取消旧运行；
- Node.js 为 22，并启用 npm cache；
- 严格按顺序执行 `npm ci`、`npm run check`、`npm run build`、`npm test`；`npm test` 包含依赖 `dist/` 的产物测试，因此必须位于构建之后；
- 质量门禁之后、Wrangler 上传之前幂等查询或创建固定 Pages project；
- 初始化步骤仅引用约定 secrets，不输出 API body、Token 或 Account ID；
- HTTP 200、404、并发冲突与其他失败状态具有明确分支；
- 使用 `cloudflare/wrangler-action@v3`；
- 上传目录为 `dist`，project name 正确；
- 只引用约定的 Cloudflare secrets 和 GitHub token；
- Job Summary 使用 action output，不包含 secret。

本地门禁：

```bash
npm run check
npm run build
npm test
npm run verify:build
```

端到端验收需要以下强证据：

- GitHub repository secrets 名称存在；
- Cloudflare Pages project 存在且 Production branch 为 `main`；
- 功能分支 Actions run 成功并产生可访问 Preview URL；
- Preview 首页、转换页、robots 与 sitemap 返回预期状态；
- PR 合并后 `main` Actions run 成功并产生可访问 Production `pages.dev` URL；
- GitHub Deployment、Cloudflare deployment 与对应 commit 一致。

## 非目标

- 不接管或修改 `devformat.tools` 现有 DNS 与站点。
- 不把 Cloudflare Git Integration 作为部署执行器。
- 不新增自定义域名、Access 登录、应用内 GitHub 登录、数据库、服务端 API 或付费资源。
- 不将 Cloudflare API Token 写入仓库或输出给 Agent。

## 决策确认

用户在查看 Direct Upload、Git Integration 与 OIDC 三种方案后回复“继续”，据此采用方案 A，并授权继续创建 GitHub Issue、隔离分支、设计文档、workflow 和真实临时部署。真实 CI 后续证明 Cloudflare 中的 `devformat-tools` 是 Worker 而非 Pages project；用户回复 `PIZHUN`，批准 workflow 使用已有 repository secrets 自动、幂等创建 Pages project。该补充决策见 [ADR-002](../../decisions/ADR-002-cloudflare-pages-idempotent-bootstrap.md)。
