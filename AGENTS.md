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
- MCP 不支持时，使用 `gh api --method POST repos/<owner>/<repo>/pulls/<pr>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'` 请求审查；随后运行 `gh api repos/<owner>/<repo>/pulls/<pr>/requested_reviewers --jq '.users[].login'` 回读。以 `login` 匹配 `/copilot/i`（例如 `copilot-pull-request-reviewer[bot]`）为准，不能把请求命令成功或显示名当作审查已登记。
- 对有效 unresolved feedback 创建修复提交并 push，必要时重新请求 review。
- 对 `agent-managed` PR，必须通过 GitHub MCP 读取正式 Copilot review 与行级 thread；每条有效 unresolved feedback 都要有可验证的修复 commit 和状态评论记录。
- 只有 `npm test`、`npm run check`、`npm run build`、GitHub Actions、Copilot review 和冲突检查全部通过后才允许 squash merge。
- 合并后验证 Issue 已关闭、远端功能分支已删除与 Production 部署成功，再同步本地 `main`。对用户入口域名，必须实际请求自定义域名并确认新 title、description 或版本标识已生效；仅凭 Preview URL、Pages deployment 或 GitHub Actions 成功不足以证明生产发布。禁止 force push、绕过 hooks 或重写已推送历史。

## 文档管理

- 仓库保留的事实来源文档：`README.md`、`CONTRIBUTING.md`、`AGENTS.md`、`docs/PRD-*.md`、`docs/decisions/`（ADR）、`docs/seo-operations.md`、`docs/superpowers/specs/`（设计稿）、`docs/verification/`（验收记录）与 `docs/research/`（已归档研究）。
- 执行计划（原 `docs/superpowers/plans/` 的新增去向）、工作日志、方案草稿与 GSC 等外部数据复盘存放于 Obsidian 工作区（`D:\Notes\20-项目\进行中\devformat-tools`），不提交仓库；既有已提交文件不迁移、不改写历史。
- Obsidian 笔记只链接仓库文档，不复制正文；方案成熟后按交付流程沉淀为仓库 ADR 或 spec。

## SEO 与产品演进

- `src/data/converters.json` 是标准 converter 的事实来源；新增或修改 converter 时，必须在同一原子任务中维护 slug、category、directions、title、description、FAQ 和正文内容，并让目录、静态路由与 sitemap 从该数据派生。
- 页面级 SEO 逻辑应保持为纯、确定性的构建期函数；后续提取时放在 `src/seo/`，由页面消费，不在组件中复制 canonical、结构化数据、相关链接或元数据拼接规则。
- Related tools 仅面向标准 converter，按可测试的语义规则派生；不得依赖 JSON 数组位置，不能混入 Session 或账户工具。
- 每个 SEO 行为变更都必须补充源码契约和静态构建产物测试，并保持 canonical、robots.txt、sitemap、JSON-LD、隐私承诺和 Popular tools 排序不被无意改变。
- 禁止批量制造仅替换关键词、方向、地区或语言的薄内容页面。新增独立工具页必须具备本地可正确执行的任务、独立输入输出、样例、FAQ 和真实正文，并通过 Issue 记录需求依据。
- Google Search Console 等外部数据用于定期生成关键词、impressions、CTR 与排名的复盘建议；除非有明确人工批准，不自动改写 title、description、正文或批量创建页面。

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
