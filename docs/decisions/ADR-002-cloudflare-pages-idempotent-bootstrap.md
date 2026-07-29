# ADR-002：由部署 workflow 幂等初始化 Cloudflare Pages 项目

## 状态

Accepted

## 日期

2026-07-29

## 背景

DevFormat.tools 采用 GitHub Actions + Cloudflare Pages Direct Upload。GitHub repository secrets 已配置最小权限 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`，但真实 CI 连续确认 Pages API 下不存在 `devformat-tools` 项目。Cloudflare 为同名资源返回的 GitHub check 指向 Workers service，证明现有资源是 Worker，不能供 `wrangler pages deploy` 使用。

Token 只存在于 GitHub secrets，不能读取回 Agent，也不应通过聊天或日志传递。继续部署需要在目标 account 中创建一个 Production branch 为 `main` 的 Direct Upload Pages project，同时保持以下边界：不修改同名 Worker、不修改 `devformat.tools` DNS、不创建付费资源、不扩大 Token 权限。

## 决策

在 `.github/workflows/deploy-pages.yml` 的完整质量门禁之后、Wrangler 上传之前增加幂等 Pages project 初始化步骤：

1. 使用 Cloudflare REST API 查询固定项目 `devformat-tools`。
2. HTTP 200 时验证响应成功、项目名一致且 Production branch 为 `main`。
3. HTTP 404 时创建 Direct Upload Pages project，名称固定为 `devformat-tools`，Production branch 固定为 `main`。
4. 并发创建冲突时重新查询并执行相同验证；其他状态立即失败。
5. API 响应只写入 runner 临时文件，并在 step 退出时删除；不把响应 body、Token 或 Account ID 输出到日志或 Job Summary。
6. 只有项目存在且验证通过后才执行 `wrangler pages deploy dist`。

该步骤持续保留在 workflow 中，用查询与验证保证后续运行幂等。它只管理固定 Pages project 的存在性，不更新、删除或迁移任何既有 Cloudflare 资源。

## 备选方案

### 维护者手动创建 Pages project

- 优点：部署 workflow 只负责部署，基础设施职责最窄。
- 缺点：Token 已安全保存于 GitHub，但 Agent 无法读取；实际操作多次把 Worker 误认为 Pages project，无法完成自动交付闭环。
- 结论：不采用。用户明确批准自动创建。

### 一次性初始化 workflow，成功后删除

- 优点：常规部署不包含资源查询。
- 缺点：需要额外 workflow、两次代码变更与额外 review；删除后失去对 Production branch 漂移的验证。
- 结论：不采用。

### 改为 Cloudflare Workers Static Assets

- 优点：可复用现有 Worker，符合 Cloudflare 对新项目的推荐方向。
- 缺点：偏离用户明确要求的 Cloudflare Pages，改变 URL、部署语义与既有设计。
- 结论：不采用。

## 后果

- 首个通过质量门禁的 branch push 可自动创建 Pages project 并继续生成 Preview。
- 后续运行增加一次只读 Pages API 查询；资源不存在时才发生创建写操作。
- Token 权限仍限定为 `Account / Cloudflare Pages / Edit`，GitHub workflow 权限仍只有 `contents: read` 与 `deployments: write`。
- 同名 Worker 保持不变；Pages、Worker 与 `devformat.tools` DNS 互不接管。
- 如果项目名不可用、Token 权限不足、Production branch 不一致或 Cloudflare 响应无法验证，部署会明确失败并保留上一成功版本。
