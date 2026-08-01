# Agent 工作规范

## 语言

- 对话、Issue、PR、文档和提交描述默认使用中文。
- 代码标识符、技术术语、CLI 命令和配置键保留英文。
- Commit 使用 Conventional Commits 英文类型和中文描述。

## GitHub 交付流程

- 非琐碎 `feat` 和 `fix` 必须执行：Issue → 原子任务 → 功能分支 → commit/push → PR → Copilot review → CI → squash merge。
- 禁止直接向 `main` commit 或 push。仓库未启用 branch protection，此规则是不可突破的 Agent 流程门禁。
- 创建 Issue 前先搜索重复项；每个 Issue 必须包含验收标准和原子任务 checklist。
- 分支使用 `feat/<issue-number>-<slug>` 或 `fix/<issue-number>-<slug>`。
- 每个原子任务应可独立验证和提交；验证通过后自动 push 当前功能分支。
- 优先使用 GitHub MCP 处理 Issue、PR、review 和 merge；仅在 MCP 不覆盖时使用 `gh`。
- 仅对显式带有 `agent-managed` 标签的 PR 启用自动化接管；状态必须写入 `## Agent Delivery Status` 评论，未标记的手工 PR 不自动处理。

## PR 与合并

- 首次 push 后创建 Draft PR，并在正文使用 `Closes #<issue-number>`。
- 所有任务完成后将 PR 转为 Ready，并通过 `request_copilot_review` 请求 GitHub Copilot review。
- 对有效 unresolved feedback 创建修复提交并 push，必要时重新请求 review。
- 对 `agent-managed` PR，必须通过 GitHub MCP 读取正式 Copilot review 与行级 thread；每条有效 unresolved feedback 都要有可验证的修复 commit 和状态评论记录。
- 只有 `npm test`、`npm run check`、`npm run build`、GitHub Actions、Copilot review 和冲突检查全部通过后才允许 squash merge。
- 合并后验证 Issue 已关闭、远端功能分支已删除与 Production 部署成功，再同步本地 `main`。禁止 force push、绕过 hooks 或重写已推送历史。

## 项目质量命令

```bash
npm run build
npm test
npm run check
```

## 安全

- 不提交 `.env`、token、私钥、日志、依赖目录、构建产物或 Agent 本地运行状态。
- 不输出敏感值；只报告路径、风险类型和脱敏上下文。
- 外部审核、CI 或权限条件无法确认时停止自动合并并报告真实状态。
