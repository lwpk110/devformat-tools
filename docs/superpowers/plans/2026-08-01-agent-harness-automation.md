# AI Harness 自动化交付闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `agent-managed` PR 建立审计状态和 MCP Agent 交付规则，支持 Issue #24 的可追溯审查、修复与合并闭环。

**Architecture:** GitHub Actions 只汇总带 `agent-managed` 标签的 PR、review 和 check 事件，并在单一 PR comment 中更新状态。MCP Agent 读取 Copilot feedback、修复和验证代码、重新审查并 squash merge；`Closes #<issue>` 关闭关联 Issue。

**Tech Stack:** GitHub Actions、GitHub MCP、Node.js 20、Vitest、Astro、TypeScript。

## Global Constraints

- 只有 `agent-managed` PR 可以被自动化接管。
- 禁止直接向 `main` commit 或 push。
- Secret Scanning 不启用、不查询，也不作为合并门禁。
- Actions 不生成代码、不合并；MCP Agent 才能修复和 merge。
- 合并必须有 `npm test`、`npm run check`、`npm run build`、GitHub checks、Copilot review、零条有效未解决反馈和无冲突证据。
- 状态评论的固定标题为 `## Agent Delivery Status`。

---

### Task 1: 定义接管标签和 PR 模板

**Files:** Create `.github/labels/agent-managed.md`; modify `.github/pull_request_template.md` and `tests/unit/repository-governance.test.ts`.

**Interfaces:** `agent-managed` 是唯一接管信号。模板产出 `## Agent Delivery` checklist 和 `## Agent Delivery Status` 状态标题。

- [ ] **Step 1: 写入失败测试。** 在 `repository-governance.test.ts` 增加断言：模板包含 `agent-managed`、`## Agent Delivery`、`## Agent Delivery Status`，且不含 `Secret scanning 未发现阻塞问题`；新增标签说明包含“仅对显式添加该标签的 PR”和“不会接管手工 PR”。
- [ ] **Step 2: 验证 RED。** 运行 `npm test -- tests/unit/repository-governance.test.ts`；预期因标签文件和模板字段缺失而失败。
- [ ] **Step 3: 最小实现。** 新增标签说明；在模板加入以下契约：`添加 agent-managed 标签以允许 AI harness 接管；未添加时仅走人工流程。` 与 ``## Agent Delivery Status` 已记录 CI、Copilot feedback、修复 commit 与合并结果。` 删除 Secret Scanning checklist。
- [ ] **Step 4: 验证 GREEN 并提交。** 运行 `npm test -- tests/unit/repository-governance.test.ts`，预期通过；执行 `gh label create agent-managed --repo lwpk110/devformat-tools --color 5319E7 --description '允许 AI harness 接管并记录交付闭环'`，然后暂存上述三文件，提交 `feat: 定义 agent 托管 PR 契约` 并 push。

### Task 2: 汇总状态工作流

**Files:** Create `.github/workflows/agent-delivery-status.yml` and `tests/unit/agent-delivery-workflow.test.ts`.

**Interfaces:** 消费 `pull_request`、`pull_request_review`、`check_suite` 事件和 PR 标签，产出单一 `## Agent Delivery Status` comment，绝不调用 merge。

- [ ] **Step 1: 写入失败测试。** 新建 workflow 测试并断言 `pull_request` 类型为 `opened`、`reopened`、`synchronize`、`labeled`、`unlabeled`、`ready_for_review`；`pull_request_review` 为 `submitted`；`check_suite` 为 `completed`。断言源码含 `contains(github.event.pull_request.labels.*.name, 'agent-managed')`、`actions/github-script@v7` 和状态标题，且不含 `pulls.merge`。
- [ ] **Step 2: 验证 RED。** 运行 `npm test -- tests/unit/agent-delivery-workflow.test.ts`；预期 workflow 文件缺失。
- [ ] **Step 3: 最小实现。** 新 workflow 监听三类事件，权限为 `contents: read`、`pull-requests: write`、`issues: write`、`checks: read`；PR 状态评论在 GitHub 权限模型中需要 `pull-requests: write`。脚本仅处理唯一关联的 PR；无关联或缺少标签时退出，Draft PR 则写入等待转为 Ready 的状态。对托管 PR 查询 check runs、Copilot review 和 review comments，生成触发事件、head SHA、checks、Copilot 状态、未解决反馈数和下一步；仅更新 `github-actions[bot]` 创建的固定标题 comment，否则创建新 comment。禁止 `pulls.merge` 与 `contents: write`。
- [ ] **Step 4: 验证 GREEN 并提交。** 运行 `npm test -- tests/unit/agent-delivery-workflow.test.ts tests/unit/repository-governance.test.ts`，预期通过；暂存 workflow 与测试，提交 `feat: 汇总 agent 托管 PR 的交付状态` 并 push。

### Task 3: 固化 MCP 交付规程

**Files:** Modify `AGENTS.md`, `docs/superpowers/specs/2026-07-29-agent-harness-github-delivery-design.md`, and `tests/unit/repository-governance.test.ts`.

**Interfaces:** 消费标签与状态 comment；定义 MCP 读取 review、修复、重新审查、squash merge 与 Issue 关闭验证的顺序。

- [ ] **Step 1: 写入失败测试。** 断言 `AGENTS.md` 含 ``agent-managed``、`GitHub MCP`、`有效 unresolved feedback`、`验证 Issue 已关闭`，且不含 `secret scanning`。
- [ ] **Step 2: 验证 RED。** 运行 `npm test -- tests/unit/repository-governance.test.ts`；预期现有规则仍含 Secret Scanning 门禁且无接管条款。
- [ ] **Step 3: 最小实现。** 更新两份规则：托管 PR 使用 MCP 读取正式 Copilot review 和行级评论，为有效意见创建带测试的修复 commit，推送后重新请求 review；checks、review 与可合并性满足后 squash merge；验证 `Closes #` 关闭 Issue、远端分支删除和 Production 部署。删除全部 Secret Scanning 门禁表述。
- [ ] **Step 4: 验证 GREEN 并提交。** 运行 `npm test -- tests/unit/repository-governance.test.ts`，预期通过；暂存三文件，提交 `docs: 固化 MCP 驱动的 agent 交付闭环` 并 push。

### Task 4: 交付 Issue #24 的 harness PR

**Files:** 使用 Tasks 1-3 的所有文件。

**Interfaces:** 产出带 `agent-managed` 标签、`Closes #24` 和状态评论的 Ready PR。

- [ ] **Step 1: 创建并接管 Draft PR。** 使用 `gh pr create --draft --base main --head feat/24-agent-harness-automation --title 'feat: 自动化 AI harness 的审查修复与合并闭环' --body 'Closes #24'` 创建 PR；执行 `gh pr edit --add-label agent-managed`。预期 Actions 创建状态评论。
- [ ] **Step 2: 全量验证和审查。** 依次运行 `npm test`、`npm run check`、`npm run build`。使用 GitHub MCP 将 PR 设为 Ready 并请求正式 Copilot review；每条有效反馈必须回到 Task 2 或 3 的 RED-GREEN 循环，带测试提交后重新请求 review。
- [ ] **Step 3: 合并验证。** 确认状态评论记录 checks 成功、Copilot 已完成、有效反馈为零和无冲突；通过 GitHub MCP squash merge。验证 PR 已合并、Issue #24 已关闭、远端分支删除、`main` CI 与 Cloudflare Production 成功，再同步本地 `main`。

### Task 5: 交付 PR #23 的 Copilot 修复

**Files:** Modify `src/components/SessionConverter.tsx` and `tests/component/SessionConverter.test.tsx` on `feat/22-unified-tool-catalog-session-workbench`.

**Interfaces:** 保留 TXT/多段 JSON 的原文回退解析，并让格式选择器的 `role="tab"` 使用 `aria-selected` 与 roving `tabIndex`。

- [ ] **Step 1: 写入失败测试。** 上传内容为 `{\"access_token\":\"first\"}\n{\"access_token\":\"second\"}` 的 `sessions.txt`，断言页面显示 `2 个账号`；渲染后断言默认格式 tab 有 `aria-selected="true"`。
- [ ] **Step 2: 验证 RED。** 运行 `npm test -- tests/component/SessionConverter.test.tsx`；预期原文被二次 JSON 序列化，tab 仍使用 `aria-pressed`。
- [ ] **Step 3: 最小实现。** `handleFiles` 分别保存可解析 JSON 与原始文本；存在原始文本时以换行拼接直接交给 `parseInputDocuments`，不再对字符串数组 `JSON.stringify`。格式按钮使用 `aria-selected={format === option}` 和 `tabIndex={format === option ? 0 : -1}`。
- [ ] **Step 4: 验证 GREEN、审查与合并。** 先运行 `npm test -- tests/component/SessionConverter.test.tsx`，随后运行 `npm test`、`npm run check`、`npm run build`；提交 `fix: 修复 Session 文件导入与 tab 语义` 并 push。通过 GitHub MCP 读取 PR #23 unresolved thread、发布修复审计评论并重新请求 Copilot review。所有检查成功、无有效反馈且可合并后 squash merge，验证 Issue #22 自动关闭、`main` CI、Cloudflare Production 及 `https://abc123456.uk/`、`/robots.txt`、`/sitemap-index.xml` 可访问。
