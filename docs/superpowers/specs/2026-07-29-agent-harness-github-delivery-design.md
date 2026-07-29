# AI Agent Harness 与 GitHub 标准交付流程设计

## 目标

为 AI Agent 建立可复用的专业 GitHub 交付基础设施，将非琐碎功能和 Bug 修复统一纳入 `Issue → 原子任务 → 功能分支 → 原子提交 → PR → Copilot review → CI → 自动合并` 流程。

系统应自动完成授权范围内的 commit、push、PR 审核闭环和合并，同时禁止直接向 `main` 推送。当前仓库保持 Private，并维持 branch protection disabled；流程门禁由 Agent harness 执行。

## 当前状态

- GitHub MCP 已通过 `https://api.githubcopilot.com/mcp/` 启用，并使用环境变量传递 token。
- MCP 已提供 Issue、PR、Copilot review、secret scanning、checks 查询和 merge 等写入能力。
- OpenAI 官方 `github@openai-api-curated` plugin 尚未安装。
- 用户级 `git-commit` skill 已安装，能够检查风险并创建原子提交，但默认不 push。
- 仓库缺少根级 `AGENTS.md`、Issue forms、PR template 和 GitHub Actions CI。
- 本地 `main` 包含多个尚未推送的设计与计划提交，需要迁移到功能分支，禁止直接推送到远端 `main`。

## 架构

采用三层协作结构：

1. **官方能力层**：安装 OpenAI 官方 GitHub plugin，复用其 `github`、`yeet`、`gh-fix-ci` 和 `gh-address-comments` skills，以及已配置的 GitHub MCP。
2. **全局编排层**：新增用户级 `github-delivery` skill，编排从 Issue 到自动合并的完整生命周期；现有 `git-commit` skill 专注原子提交并向编排器交回结果。
3. **仓库约束层**：使用 `AGENTS.md`、`.github` 模板和 GitHub Actions 固化本项目规则、质量门禁和交付文档格式。

GitHub MCP 是 Issue、PR、review、secret scanning 和 merge 的首选接口。`git` 负责本地分支与提交；`gh` 仅补足 MCP 不擅长的 Actions 日志、当前分支 PR 发现和仓库设置操作。

## 组件职责

### `git-commit`

- 检查敏感信息、生成物、混合改动和 staged diff。
- 按逻辑目的拆分原子提交。
- 为每组改动执行最小相关验证。
- 返回 commit SHA、提交信息、验证结果和未提交改动。
- 不负责创建 Issue、PR、review 或合并。

### `github-delivery`

- 判断任务是否需要 Issue。
- 搜索重复 Issue，创建或关联目标 Issue。
- 将验收标准拆成原子任务 checklist。
- 建立功能分支并协调 `git-commit`。
- 每个原子任务完成后自动 push 当前功能分支。
- 创建和维护单一 Draft PR。
- 将 PR 转为 Ready 并请求 Copilot review。
- 处理 review feedback、CI 失败和合并冲突。
- 在所有门禁通过后执行 squash merge 并同步本地 `main`。

### 官方 GitHub plugin

- `github`：GitHub 仓库、Issue 和 PR 的统一入口。
- `yeet`：本地改动发布和 Draft PR 流程参考。
- `gh-fix-ci`：GitHub Actions 失败诊断与修复。
- `gh-address-comments`：读取和处理 unresolved review threads。

### 仓库配置

- `AGENTS.md`：Agent 的持久交付规则和质量命令。
- `.github/ISSUE_TEMPLATE/feature.yml`：功能需求表单。
- `.github/ISSUE_TEMPLATE/bug.yml`：Bug 报告表单。
- `.github/ISSUE_TEMPLATE/config.yml`：禁用空白 Issue 并配置模板入口。
- `.github/pull_request_template.md`：PR 背景、关联 Issue、风险和验证模板。
- `.github/workflows/ci.yml`：测试、类型检查和生产构建。

## Issue 策略

所有非琐碎 `feat` 和 `fix` 在实施前必须创建或关联 GitHub Issue。纯 `docs`、`chore`、格式调整和不改变行为的维护默认不强制 Issue，用户指令可覆盖。

创建 Issue 前必须搜索标题、关键词和开放 Issue，避免重复。Issue 至少包含：

- 背景与动机；
- 当前行为或问题；
- 目标结果；
- 可验证的验收标准；
- 风险或限制；
- 原子任务 checklist。

标签使用 `type:feature`、`type:bug`、`status:ready` 和 `status:blocked`。创建 Issue 后将其 URL 与编号作为后续分支、PR 和提交的关联依据。

## 分支与原子任务

- `main` 是流程级保护分支，Agent 禁止直接 commit 或 push。
- 功能分支从最新远端 `main` 创建。
- 分支命名为 `feat/<issue-number>-<slug>` 或 `fix/<issue-number>-<slug>`。
- 每个 Issue checklist 项必须可独立实现、验证和提交。
- 每完成一个原子任务，运行相关验证并创建一个或多个聚焦 commit，然后自动 push 功能分支。
- 验证失败时不提交、不 push 该原子任务。
- 不把来源不明或无关的工作区改动纳入交付。

## PR 流程

首次 push 后创建 Draft PR。PR 标题使用 Conventional Commits，正文基于模板并包含 `Closes #<issue-number>`。同一 Issue 和分支只维护一个 PR。

后续原子提交自动 push 到同一 PR。所有 checklist 和本地验证完成后：

1. 更新 PR 正文和验证结果。
2. 将 PR 从 Draft 转为 Ready for review。
3. 使用 GitHub MCP `request_copilot_review` 请求 Copilot code review，不以普通 `@copilot` 评论替代审核请求。
4. 读取 Copilot review、requested changes 和 unresolved threads。
5. 对有效意见创建原子修复提交并 push；必要时重新请求 review。

## CI 与自动合并门禁

GitHub Actions 对目标为 `main` 的 PR 执行：

```text
npm ci
npm test
npm run check
npm run build
```

workflow 使用 Node.js 20、依赖缓存、并发取消和 `contents: read` 最小权限。

仅在以下条件全部满足时允许 GitHub MCP 执行 squash merge：

- PR 已 Ready for review；
- Issue 原子任务全部完成；
- 本地验证和 GitHub Actions 全部成功；
- Copilot review 已完成；
- 没有未解决的有效 review 意见；
- PR 与 `main` 无合并冲突；
- secret scanning 未发现阻塞问题。

合并提交标题沿用规范化 PR 标题。合并后删除远端功能分支，由 `Closes` 自动关闭 Issue，并同步本地 `main`。

## 仓库设置

- 保持仓库 Private。
- 保持 branch protection disabled，不尝试重新启用 rules。
- 开启 squash merge。
- 关闭 merge commit 和 rebase merge，确保主分支历史以 Issue/PR 为原子单位。
- 开启合并后自动删除 head branch。

由于服务端没有 branch protection，Agent 必须在每次写操作前检查目标分支，并将“禁止直接 push `main`”视为不可突破的流程约束。该约束不能阻止其他客户端直接推送，属于已接受的剩余风险。

## 异常处理

- 写操作前确认 GitHub 身份、仓库、Issue、PR 和分支目标。
- 创建 Issue、分支和 PR 前先查询已有对象，保证重试幂等。
- GitHub MCP、Copilot review 或 `gh` 认证失败时停止外部写入。
- push 被拒绝时报告，不自动 force push 或改写历史。
- 功能分支与 `main` 冲突时合并最新 `main` 到功能分支，不 rebase 已推送历史。
- CI 疑似 flaky 时最多重试一次；再次失败后按真实故障处理。
- MCP secret scanning 不可用时执行本地敏感信息检查，并明确保障降级。
- 自动合并失败时保留 PR 和分支，不通过直推 `main` 补救。
- 所有日志与汇报隐藏 token、密钥和敏感内容。

## 当前提交迁移

当前本地 `main` 存在尚未推送的提交，且提交数量会包含本设计与后续实施计划。实施时：

1. 创建本次基础设施 Issue。
2. 从当前 `HEAD` 创建 `feat/<issue-number>-agent-harness`，保留现有提交。
3. 在功能分支追加基础设施原子提交并 push。
4. 通过完整 PR 流程合并，禁止直接推送本地 `main`。
5. 合并后在仍位于功能分支时，将本地 `main` 引用安全更新为 `origin/main`，再切换到 `main`；不使用 force push。

## 验证策略

### 本地结构验证

- 使用官方 `quick_validate.py` 验证新增或更新的 skills。
- 检查官方 GitHub plugin 已安装，四个 GitHub skills 可发现。
- 检查 GitHub MCP 身份和仓库只读请求成功。
- 校验 Issue forms、PR template 和 GitHub Actions YAML。

### 项目质量验证

- `npm test`
- `npm run check`
- `npm run build`

### 端到端验证

使用本次基础设施改动完成真实闭环：

1. 创建基础设施 Issue。
2. 创建并 push 功能分支和原子提交。
3. 创建 Draft PR 并转为 Ready。
4. 请求 Copilot review。
5. 等待并检查 CI 与 review 状态。
6. 条件满足后自动 squash merge、删除分支并同步本地 `main`。

任何外部审核、CI 或权限条件未满足时，验证停在 PR 阶段并报告实际状态，不将“PR 已创建”描述为“交付已完成”。

## 完成标准

- 官方 GitHub plugin 安装并可用。
- `github-delivery` 与更新后的 `git-commit` 通过官方校验。
- 仓库级 Agent 规则、Issue forms、PR template 和 CI 已纳入版本控制。
- 标签和仓库合并设置符合设计。
- 本次变更拥有 Issue、功能分支、原子提交、PR、Copilot review 和成功 CI 证据。
- PR 自动 squash merge，远端功能分支删除，本地 `main` 与 `origin/main` 一致且工作区干净。
