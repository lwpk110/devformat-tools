# Copilot Review 超时恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让带 `agent-managed` 标签的 Ready PR 在 Copilot 未被正式登记或未响应时进入可见、可恢复且可审计的阻塞状态。

**Architecture:** 新增一个由 `schedule` 和 `workflow_dispatch` 共用的 GitHub Actions 扫描器。扫描器只读取开放 PR 的 `requested_reviewers`、正式 review 和现有状态评论，并以 HTML 注释 JSON 维护同一条状态评论；无真实 Copilot reviewer 时立即阻塞，只有 reviewer 已登记后才进行 15 分钟、60 分钟和六小时的超时状态转换。

**Tech Stack:** GitHub Actions、actions/github-script@v7、GitHub REST API、Vitest、TypeScript、YAML。

## Global Constraints

- 仅处理 Ready 且带 `agent-managed` 标签的开放 PR。
- `requested_reviewers` 中实际存在 Copilot 才算正式 review request 已登记；API 返回成功或评论 `@copilot review` 均不构成证据。
- 缺少 Copilot reviewer 时立即添加 `status:blocked`，不得进入 15 分钟或 60 分钟的等待循环。
- workflow 只允许 `contents: read`、`pull-requests: write`、`issues: write`、`checks: read`；不得有 `contents: write`、merge 或关闭 Issue 的权限/调用。
- 复用 `## Agent Delivery Status` 单一评论，机器状态放在 HTML 注释 JSON，重复运行不得刷屏或重复发布 review 命令。
- Secret Scanning 不启用，也不作为本功能的门禁。
- 禁止直接向 `main` commit 或 push；PR #27 以 PR #25 分支为 base，待 #25 合并后再切换 base。

---

### Task 1: 锁定恢复工作流契约

**Files:** Modify `tests/unit/agent-delivery-workflow.test.ts`.

**Interfaces:** 测试消费 `.github/workflows/agent-delivery-recovery.yml`，约束触发器、权限、真实 reviewer 验证、阻塞标签与禁止操作。

- [x] **Step 1: 写入失败测试。** 新增 `describe('Copilot review 恢复工作流')`，读取 recovery workflow 并断言：`schedule` 为 `*/15 * * * *`、含 `workflow_dispatch`、权限为 `contents: read`、`pull-requests: write`、`issues: write`、`checks: read`；源码含 `requested_reviewers`、`status:blocked`、`@copilot review`、`15 * 60 * 1000`、`60 * 60 * 1000`、`6 * 60 * 60 * 1000` 与 HTML 注释状态标记；源码不含 `pulls.merge`、`contents: write` 和关闭 Issue 的状态写入。
- [x] **Step 2: 验证 RED。** 已运行 `npm test -- tests/unit/agent-delivery-workflow.test.ts`；因 recovery workflow 不存在而失败。
- [x] **Step 3: 最小实现。** 失败测试已保留至 Task 2，与 production workflow 同一原子提交。
- [x] **Step 4: 提交边界。** 测试与实现将同一原子提交，避免分支出现无法通过的工作流契约。

### Task 2: 实现可审计的 Copilot 恢复状态机

**Files:** Create `.github/workflows/agent-delivery-recovery.yml`; modify `tests/unit/agent-delivery-workflow.test.ts`.

**Interfaces:**
- Consumes: GitHub REST `pulls.list`、`pulls.get`、`pulls.listReviews`、`issues.listComments`、`issues.createComment`、`issues.updateComment`；`pr.requested_reviewers`。
- Produces: 单一 `## Agent Delivery Status` 评论和 `status:blocked` 标签；状态 JSON 字段为 `state`、`waitingSince`、`requestCount`、`lastRetryAt`、`nextCheckAt`。

- [x] **Step 1: 保持 RED 证据。** 已再次运行 `npm test -- tests/unit/agent-delivery-workflow.test.ts`；同一组 recovery 契约因文件缺失失败。
- [x] **Step 2: 写入最小 workflow。** 已新增 `agent-delivery-recovery.yml`：使用 `schedule: [{ cron: '*/15 * * * *' }]` 和 `workflow_dispatch`；`github-script` 分页读取开放 PR；跳过 Draft 或无 `agent-managed` 标签的 PR；读取完整 PR 的 `requested_reviewers` 和正式 reviews。
- [x] **Step 3: 实现状态决策。** Copilot reviewer 不在 `requested_reviewers` 且无正式 Copilot review 时，添加 `status:blocked` 并写入 `blocked-review-request-not-accepted`，评论明确指出 GitHub Copilot Code Review 需要为该仓库启用；发现正式 Copilot review 时移除 blocked 并设为 `waiting-for-feedback`；已登记但无 review 时以时间状态依次进入 `waiting-for-review`、一次命令评论、`blocked-no-response` 与每六小时一次命令评论。
- [x] **Step 4: 实现幂等审计。** 已解析固定标题评论的 `<!-- agent-delivery-state: {...} -->`；只更新该评论，不新建重复状态评论；只有到达时间阈值时才发布 `@copilot review`；单个 PR 的 API 异常以脱敏错误类别写入 workflow 日志。
- [x] **Step 5: 验证 GREEN。** 已运行 `npm test -- tests/unit/agent-delivery-workflow.test.ts` 和 `npm run check`，均通过。
- [ ] **Step 6: 提交并推送。** 暂存 workflow、测试与计划，执行 `git diff --cached --check`，提交 `fix: 阻塞未登记的 Copilot reviewer 请求`，随后 push `fix/27-copilot-review-recovery`。

### Task 3: 完整验证与依赖 PR 交付

**Files:** 使用 Tasks 1-2 的所有文件，以及现有 `docs/decisions/ADR-004-copilot-review-timeout-recovery.md` 和 `docs/superpowers/specs/2026-08-01-copilot-review-recovery-design.md`。

**Interfaces:** PR #27 的 base 为 `feat/24-agent-harness-automation`，正文关联 `Closes #27`，并带 `agent-managed` 标签。

- [x] **Step 1: 全量本地验证。** 已依次运行 `npm run build`、`npm test` 和 `npm run check`；构建成功，169 个测试通过，静态检查无诊断。
- [x] **Step 2: 创建依赖 Draft PR。** 已创建 Draft PR #28：`fix/27-copilot-review-recovery` 到 `feat/24-agent-harness-automation`，正文包含 `Closes #27`、真实 reviewer 验证行为、权限约束和本地验证；已添加 `agent-managed`，远端 CI 与部署检查均通过。
- [ ] **Step 3: 请求与验证 reviewer。** PR 转 Ready 后，通过 GitHub MCP 请求正式 Copilot review，随后读取 `requested_reviewers`。只有 reviewer 列表实际出现 Copilot 才进入等待审查；否则由恢复 workflow 标记 `status:blocked`，不得 merge。
- [ ] **Step 4: 处理反馈与 CI。** GitHub checks 完成后，读取正式 review 与 unresolved thread；每条有效反馈回到 RED-GREEN 循环、原子提交并 push，然后重新请求并验证 Copilot reviewer。
- [ ] **Step 5: 合并闭环。** 仅在 PR #25 已合并、PR #27 retarget 至 `main`、CI 成功、Copilot reviewer 已登记且 review 完成、无有效 unresolved feedback、无冲突时 squash merge；验证 Issue #27 自动关闭、远端分支删除和 Production 部署成功，再同步本地 `main`。

## 自检

- 规格中的 reviewer-list、15 分钟、60 分钟、六小时、blocked、恢复、单一状态评论、权限和不自动 merge 均被 Tasks 1-3 覆盖。
- 未包含 TBD、TODO 或依赖未定义接口的步骤。
- `requested_reviewers`、状态 JSON 字段、标签名和评论标题在所有任务中保持一致。
