# ADR-004: 使用定时状态机恢复未响应的 Copilot review

## 状态

Accepted

## 日期

2026-08-01

## 背景

ADR-003 规定 Agent 管理 PR 必须有正式 Copilot review，但未定义 Copilot 不返回事件时的恢复路径。PR 会因此无限期停留在 Ready 状态，Issue 也无法闭环。

## 决策

使用 GitHub Actions `schedule` 每 15 分钟扫描 `agent-managed` PR。等待 15 分钟后自动发布一次 review 命令，60 分钟后添加 `status:blocked`，之后每 6 小时再次重试。正式 review 出现后自动移除 blocked 标签并在状态评论记录恢复。

## 后果

- 无响应的外部审查从隐性停滞变为可见、可恢复的状态。
- 评论内状态 JSON 让重试跨 workflow 运行保持幂等。
- Actions 仍不拥有 merge 或内容写入权限；MCP Agent 继续负责有判断的修复与合并。
- Copilot 长期不可用时 PR 保持 blocked，避免在没有正式审查的情况下自动合并。
