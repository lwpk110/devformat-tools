# AI Harness 自动化闭环设计

## 目标

为带有 `agent-managed` 标签的 PR 建立可追溯的交付闭环：Agent 通过 GitHub MCP 读取 Copilot review，修复有效反馈并验证，在质量门禁满足后 squash merge 到 `main`，由 `Closes #<issue>` 自动关闭关联 Issue。

## 范围

- 仅接管显式带有 `agent-managed` 标签的 PR。
- GitHub Actions 负责接收 PR、review 和 check 事件并汇总状态。
- 具有 GitHub MCP 权限的 Agent 负责理解代码、修复反馈、提交、推送、重新请求 review 和合并。
- Secret Scanning 不启用、不查询，也不作为本项目合并门禁。

不在范围内：接管手工 PR、由 Actions 生成代码或直接合并、变更 GitHub 订阅或仓库可见性。

## 方案选择

采用“Actions 汇总 + MCP Agent 决策执行”方案。

- 本地会话轮询无法在 Agent 离开后保留可追溯状态。
- Actions 直接调用 GitHub API 可以自动合并，但不适合处理需要阅读源码和测试的 Copilot 反馈。
- 事件驱动的状态汇总与 MCP 的代码修复能力结合，既保留自动化，也使每次写入都可由 PR 事件、commit 和评论追溯。

## 状态模型

`agent-managed` PR 以 PR comment 中的固定标题 `## Agent Delivery Status` 记录下列状态。

| 状态 | 进入条件 | 自动动作 | 退出条件 |
| --- | --- | --- | --- |
| `waiting-for-checks` | PR 创建或同步 | 汇总本地与 GitHub checks | 全部成功后进入 `waiting-for-review` |
| `waiting-for-review` | checks 成功 | Agent 使用 MCP 请求或读取 Copilot review | Copilot review 完成 |
| `addressing-feedback` | 存在有效未解决的 Copilot thread | Agent 在功能分支修复、运行测试、提交并推送 | 新 commit 与测试结果已记录 |
| `ready-to-merge` | checks 成功、无有效未解决反馈、PR 可合并 | Agent 使用 MCP squash merge | GitHub 返回 merged |
| `merged` | 合并成功 | 验证关联 Issue 关闭、分支删除和 Production 部署 | 验证结果已记录 |
| `blocked` | MCP、CI 或 mergeability 无法确认 | 输出阻塞原因与人工所需动作 | 发生新的相关事件 |

`agent-managed` 缺失时，工作流不写状态也不触发 Agent 交付操作。

## 反馈处理契约

1. Agent 通过 GitHub MCP 读取正式 Copilot review 与未解决行级 thread。
2. 仅将可复现的行为、正确性、安全性或可访问性问题视为有效反馈；纯摘要、重复反馈和已过时上下文只记录理由。
3. 每条有效反馈必须对应一个修复 commit、行为测试和 PR 状态评论中的链接或 SHA。
4. 推送修复后重新请求 Copilot review，并再次检查全部 GitHub checks。
5. 不得以普通评论替代正式 Copilot review，也不得跳过未解决的有效反馈。

## 合并与审计

合并前必须有以下证据：PR 为 Ready、`npm test`、`npm run check` 和 `npm run build` 成功；GitHub Actions 成功；Copilot 已完成 review 且无有效未解决反馈；PR 可合并且无冲突。Secret Scanning 不属于该检查。

Agent 使用 GitHub MCP 进行 squash merge。PR 正文必须含 `Closes #<issue>`；合并后 Agent 验证 Issue 状态为 closed、远端分支已删除、`main` 部署成功，并将结果写入状态评论。

## 失败处理

- MCP 不可用、CI 失败、review 未返回、合并冲突或关联 Issue 未关闭时，状态更新为 `blocked`，包含发生时间、证据链接和恢复条件。
- Agent 不得在状态未知时合并，也不得改写已经推送的分支历史。
- 质量门禁失败仅允许一次由事件驱动的重新检查；持续失败必须保留真实失败信息。

## 测试与验收

- 治理契约测试验证标签、PR 模板、工作流触发条件和 Secret Scanning 非门禁规则。
- 工作流契约测试验证 `pull_request`、`pull_request_review` 和 `check_suite` 事件，以及仅对 `agent-managed` 运行。
- 文档契约测试验证 MCP review、修复 commit、squash merge 与 Issue 关闭验证均有明确规定。
- 全量执行 `npm test`、`npm run check`、`npm run build`，并在 PR 中通过 Copilot review 与 CI。
