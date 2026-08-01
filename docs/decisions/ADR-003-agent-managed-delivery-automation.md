# ADR-003: 仅对 agent-managed PR 执行自动化交付

## 状态

Accepted

## 日期

2026-08-01

## 背景

项目希望减少人工介入，同时保留从 Issue 到 Production 的可追溯交付记录。现有文档规定 Agent 应处理 Copilot review 和自动合并，但没有机器可识别的接管边界、状态记录或明确的 Secret Scanning 降级策略。

## 决策

引入 `agent-managed` 标签作为唯一自动化接管信号。GitHub Actions 只汇总 PR、review 与 check 事件；拥有 GitHub MCP 权限的 Agent 读取正式 Copilot review，提交经过测试的修复，并在门禁满足后 squash merge。PR comment 记录每个状态与证据，`Closes #<issue>` 负责自动关闭 Issue。

Secret Scanning 不启用、不检查、不作为合并门禁。该决定反映当前用户偏好和私有仓库套餐限制；合并仍要求本地质量命令、GitHub checks、Copilot review 和可合并状态。

## 考虑过的方案

### 全部由本地 Agent 轮询

实现成本低，但会话结束后状态丢失，且难以证明何时因何阻塞。

### 由 GitHub Actions 直接自动合并

持续性强，但工作流无法可靠理解复杂源码反馈，也会把高风险的代码修复权限放入静态脚本。

### 接管全部 PR

会改变手工 PR 的预期审批方式，可能在作者不知情时触发合并。

## 后果

- Agent 托管 PR 获得稳定、可查询的交付状态和自动关闭 Issue 行为。
- 手工 PR 不受影响，必须显式添加 `agent-managed` 才会进入自动化流程。
- Actions 不持有代码生成或合并职责；MCP 不可用时会留下 `blocked` 状态而非静默降级。
- Secret Scanning 风险需要通过提交前检查和代码审查控制，未来如策略改变应以新 ADR 替代本决定。
