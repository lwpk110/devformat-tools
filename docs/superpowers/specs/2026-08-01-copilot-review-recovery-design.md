# Copilot Review 超时恢复设计

## 目标

防止 `agent-managed` PR 在 Copilot 未返回正式 review 时静默停留。系统每 15 分钟扫描一次，按等待时长触发一次初始重试、阻塞标记、六小时重试和自动恢复，并在同一状态评论中保留证据。

## 状态与时间规则

| 条件 | 动作 | 状态评论 |
| --- | --- | --- |
| 首次发现无 Copilot review | 记录 `waiting-for-review`、等待起点与请求次数 | 下次检查时间 |
| 等待满 15 分钟且未重试 | 发布一次 `@copilot review` | 请求次数加一、下一次检查时间 |
| 等待满 60 分钟且无 review | 添加 `status:blocked` | 原因是 Copilot 未响应、六小时后重试 |
| blocked 满 6 小时且无 review | 发布一次 `@copilot review` | 更新请求次数与重试时间 |
| 发现正式 Copilot review | 移除 `status:blocked` | `waiting-for-feedback` 或 `ready-to-merge` |

每次扫描读取并更新同一条 `## Agent Delivery Status` 评论。评论包含 `状态`、`等待开始时间`、`Copilot 请求次数`、`上次重试时间` 与 `下次检查时间`，以 HTML 注释保存机器可读 JSON，供后续扫描幂等恢复。

## 执行模型

新增独立 workflow，使用 `schedule` 每 15 分钟触发，并支持 `workflow_dispatch` 人工恢复。它只读取开放 PR，筛选 Ready 且带 `agent-managed` 标签的对象，读取正式 Copilot review 与状态评论。Actions 不调用 merge API，不修改仓库内容，也不关闭 Issue。

由于 GitHub Actions 无法可靠地直接创建 Copilot reviewer request，workflow 的重试动作只发布一次命令评论。具备 GitHub MCP 的常驻 Agent 在扫描状态为 `waiting-for-review`、`addressing-feedback` 或 `ready-to-merge` 时执行 MCP review、代码修复与 merge。若 MCP 不可用，状态仍保留为 blocked，而不会静默跳过。

## 权限与失败处理

workflow 权限仅为 `pull-requests: write`、`issues: write`、`checks: read`、`contents: read`。重复 schedule 运行通过状态 JSON 判断是否到达下次重试时间，因此不会刷评论或重复添加标签。API 失败时将状态更新为 `blocked` 并记录错误类别；不会删除标签或覆盖已有审计信息。

## 验收

- workflow 契约测试验证 `schedule`、`workflow_dispatch`、15 分钟与 6 小时策略、`status:blocked` 及无 merge 权限。
- 单元测试验证状态 JSON 的解析、时间判断和幂等重试决策。
- PR #27 依赖 PR #25；两个 PR 合并后，以已存在的 PR #25 状态评论验证扫描不会产生重复命令评论。
