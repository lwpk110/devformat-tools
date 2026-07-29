# Agent Harness GitHub Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可自动完成 Issue、原子任务、commit/push、PR、Copilot review、CI 和 squash merge 的专业 AI Agent GitHub 交付基础设施。

**Architecture:** 安装 OpenAI 官方 GitHub plugin 作为 GitHub/MCP 能力层，新增用户级 `github-delivery` skill 作为端到端编排层，并以仓库级 `AGENTS.md`、Issue forms、PR template 和 GitHub Actions 固化项目门禁。GitHub MCP 优先承担结构化 GitHub 写操作，`git` 管理本地历史，`gh` 仅补足 Actions 日志和仓库设置。

**Tech Stack:** Codex Agent Skills、OpenAI GitHub plugin、GitHub MCP、GitHub CLI、GitHub Actions、Git、Astro、Vitest、YAML

## Global Constraints

- 仓库保持 Private，branch protection 保持 disabled。
- Agent 禁止直接向 `main` commit 或 push。
- 所有非琐碎 `feat` 和 `fix` 必须先创建或关联 Issue。
- 每个 Issue 拆成可独立验证、提交和追踪的原子任务。
- 每个原子任务验证通过后自动 commit 并 push 功能分支。
- PR 必须请求 GitHub Copilot review，并处理所有有效 unresolved feedback。
- 仅在 CI、Copilot review、冲突和 secret scanning 门禁全部通过后自动 squash merge。
- 禁止 force push、重写已推送历史、绕过 hooks 或把 token 写入仓库。
- GitHub MCP token 继续通过环境变量提供。
- 项目质量命令固定为 `npm test`、`npm run check` 和 `npm run build`。

---

### Task 1: 安装官方 GitHub plugin 并创建交付 Issue

**Files:**
- Verify: `/home/luwei/.codex/config.toml`
- Verify: `/home/luwei/.codex/.tmp/plugins/plugins/github/.codex-plugin/plugin.json`

**Interfaces:**
- Consumes: GitHub 账号 `lwpk110`、仓库 `lwpk110/devformat-tools`、已启用的 `github` MCP。
- Produces: 已安装的 `github@openai-api-curated` plugin；唯一开放基础设施 Issue；运行时整数 `delivery_issue_number`。

- [ ] **Step 1: 安装并验证 OpenAI 官方 GitHub plugin**

Run:

```bash
codex plugin add github@openai-api-curated
codex plugin list | rg '^github@openai-api-curated\s+installed'
```

Expected: plugin 状态为 `installed`，且包含 `github`、`yeet`、`gh-fix-ci`、`gh-address-comments` skills。若已安装，安装命令应作为幂等检查处理，不创建重复安装。

- [ ] **Step 2: 验证 GitHub MCP 和 GitHub CLI 身份**

Run:

```bash
codex mcp list | rg '^github\s+https://api.githubcopilot.com/mcp/.*enabled'
gh auth status
gh repo view lwpk110/devformat-tools --json nameWithOwner,visibility,defaultBranchRef
```

Expected: MCP 为 enabled，CLI 登录用户为 `lwpk110`，仓库为 Private，默认分支为 `main`。同时调用 GitHub MCP `get_me({})`，确认 MCP 身份也是 `lwpk110`。

- [ ] **Step 3: 幂等创建标准标签**

Run:

```bash
gh label create 'type:feature' --repo lwpk110/devformat-tools --color 1D76DB --description '新增或增强用户可见功能' --force
gh label create 'type:bug' --repo lwpk110/devformat-tools --color D73A4A --description '修复可复现的软件缺陷' --force
gh label create 'status:ready' --repo lwpk110/devformat-tools --color 0E8A16 --description '需求清晰，可以开始实施' --force
gh label create 'status:blocked' --repo lwpk110/devformat-tools --color B60205 --description '存在外部依赖或阻塞条件' --force
gh label list --repo lwpk110/devformat-tools --json name --jq '.[].name' | rg '^(type:feature|type:bug|status:ready|status:blocked)$'
```

Expected: 四个标签各出现一次。

- [ ] **Step 4: 搜索重复 Issue 后创建基础设施 Issue**

先调用 GitHub MCP：

```text
search_issues({
  query: "repo:lwpk110/devformat-tools is:issue in:title Agent Harness GitHub 标准交付基础设施",
  perPage: 10
})
```

若没有同目标开放 Issue，调用：

```text
issue_write({
  method: "create",
  owner: "lwpk110",
  repo: "devformat-tools",
  title: "feat: 建立 AI Agent GitHub 标准交付基础设施",
  labels: ["type:feature", "status:ready"],
  body: "## 背景\n\n当前仓库缺少统一的 Agent Issue、原子任务、PR、Copilot review 和 CI 交付闭环。\n\n## 目标\n\n建立可复用的专业 GitHub 交付基础设施，在流程级禁止直推 main，并在门禁通过后自动 squash merge。\n\n## 验收标准\n\n- [ ] 安装 OpenAI 官方 GitHub plugin\n- [ ] 建立全局 github-delivery skill\n- [ ] 更新 git-commit skill 的交付协作边界\n- [ ] 增加仓库级 AGENTS.md\n- [ ] 增加功能与 Bug Issue forms\n- [ ] 增加 PR template\n- [ ] 增加 GitHub Actions CI\n- [ ] 请求 Copilot review 并处理有效意见\n- [ ] CI 与 secret scanning 通过后自动 squash merge\n\n## 风险\n\n仓库保持 branch protection disabled，因此 main 禁止直推属于 Agent 流程约束，不能阻止其他客户端写入。"
})
```

Expected: 获得唯一开放 Issue URL 和整数编号。若搜索命中同目标开放 Issue，复用该 Issue，不重复创建。

- [ ] **Step 5: 从 Issue 解析编号并创建功能分支**

Run:

```bash
delivery_issue_number="$(gh issue list --repo lwpk110/devformat-tools --state open --search 'Agent Harness GitHub 标准交付基础设施 in:title' --json number,title --jq 'map(select(.title == "feat: 建立 AI Agent GitHub 标准交付基础设施")) | if length == 1 then .[0].number else error("基础设施 Issue 不是唯一开放项") end')"
test "$delivery_issue_number" -gt 0
delivery_branch="feat/${delivery_issue_number}-agent-harness"
git switch -c "$delivery_branch"
test "$(git branch --show-current)" = "$delivery_branch"
```

Expected: 当前分支为 `feat/${delivery_issue_number}-agent-harness`，其中变量是 GitHub 返回的真实整数；本地 `main` 的所有未推送提交均可从该分支到达。

### Task 2: 以测试驱动实现仓库级治理配置

**Files:**
- Create: `tests/unit/repository-governance.test.ts`
- Create: `AGENTS.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/pull_request_template.md`
- Create: `.github/workflows/ci.yml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 的功能分支与 Issue 编号。
- Produces: 可由 Vitest 验证的仓库级交付规则、模板和 CI；忽略本地 `.superpowers/` 运行状态。

- [ ] **Step 1: 编写失败的治理契约测试**

创建 `tests/unit/repository-governance.test.ts`：

```typescript
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('仓库交付治理契约', () => {
  test('AGENTS 禁止直推 main 并定义 Issue 到自动合并流程', () => {
    const guidance = read('AGENTS.md')
    expect(guidance).toContain('禁止直接向 `main` commit 或 push')
    expect(guidance).toContain('Issue → 原子任务 → 功能分支 → commit/push → PR')
    expect(guidance).toContain('request_copilot_review')
    expect(guidance).toContain('squash merge')
  })

  test.each([
    ['feature.yml', 'type:feature'],
    ['bug.yml', 'type:bug'],
  ])('%s 是带标准标签的有效 Issue form', (file, label) => {
    const form = parse(read(`.github/ISSUE_TEMPLATE/${file}`))
    expect(form.name).toBeTypeOf('string')
    expect(form.description).toBeTypeOf('string')
    expect(form.labels).toContain(label)
    expect(form.body.length).toBeGreaterThanOrEqual(4)
    const ids = form.body.flatMap((item: { id?: string }) => item.id ?? [])
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('Issue 配置禁止空白 Issue', () => {
    const config = parse(read('.github/ISSUE_TEMPLATE/config.yml'))
    expect(config.blank_issues_enabled).toBe(false)
  })

  test('PR 模板要求关联 Issue、验证和审核门禁', () => {
    const template = read('.github/pull_request_template.md')
    expect(template).toContain('Closes #')
    expect(template).toContain('## Why')
    expect(template).toContain('## What Changed')
    expect(template).toContain('## Verification')
    expect(template).toContain('Copilot review')
  })

  test('CI 在 main 的 PR 上使用 Node 20 执行完整门禁', () => {
    const workflow = parse(read('.github/workflows/ci.yml'))
    expect(workflow.on.pull_request.branches).toContain('main')
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.jobs.quality['timeout-minutes']).toBe(15)
    const steps = workflow.jobs.quality.steps
    expect(steps.find((step: { uses?: string }) => step.uses === 'actions/setup-node@v4').with['node-version']).toBe(20)
    expect(steps.map((step: { run?: string }) => step.run).filter(Boolean)).toEqual([
      'npm ci',
      'npm test',
      'npm run check',
      'npm run build',
    ])
  })
})
```

- [ ] **Step 2: 运行测试并确认因治理文件缺失而失败**

Run:

```bash
npm test -- tests/unit/repository-governance.test.ts
```

Expected: FAIL，首个错误指向缺失的 `AGENTS.md`，而不是测试语法或导入错误。

- [ ] **Step 3: 创建仓库级 AGENTS.md**

创建 `AGENTS.md`：

```markdown
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
- 优先使用 GitHub MCP 处理 Issue、PR、review、secret scanning 和 merge；仅在 MCP 不覆盖时使用 `gh`。

## PR 与合并

- 首次 push 后创建 Draft PR，并在正文使用 `Closes #<issue-number>`。
- 所有任务完成后将 PR 转为 Ready，并通过 `request_copilot_review` 请求 GitHub Copilot review。
- 对有效 unresolved feedback 创建修复提交并 push，必要时重新请求 review。
- 只有 `npm test`、`npm run check`、`npm run build`、GitHub Actions、Copilot review、冲突检查和 secret scanning 全部通过后才允许 squash merge。
- 合并后删除功能分支并同步本地 `main`。禁止 force push、绕过 hooks或重写已推送历史。

## 项目质量命令

```bash
npm test
npm run check
npm run build
```

## 安全

- 不提交 `.env`、token、私钥、日志、依赖目录、构建产物或 Agent 本地运行状态。
- 不输出敏感值；只报告路径、风险类型和脱敏上下文。
- 外部审核、CI 或权限条件无法确认时停止自动合并并报告真实状态。
```

- [ ] **Step 4: 创建 Issue forms 与配置**

创建 `.github/ISSUE_TEMPLATE/config.yml`：

```yaml
blank_issues_enabled: false
```

创建 `.github/ISSUE_TEMPLATE/feature.yml`：

```yaml
name: 功能需求
description: 提议一个可验证的产品或工程能力
title: "feat: "
labels:
  - type:feature
  - status:ready
body:
  - type: markdown
    attributes:
      value: 请描述问题和目标，不要只描述实现方案。
  - type: textarea
    id: background
    attributes:
      label: 背景与问题
      description: 当前存在什么问题，影响哪些用户或维护者？
    validations:
      required: true
  - type: textarea
    id: goal
    attributes:
      label: 目标结果
      description: 完成后应观察到什么结果？
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 验收标准与原子任务
      description: 使用 checklist 描述可独立验证的结果和任务。
      placeholder: "- [ ] 验收结果或原子任务"
    validations:
      required: true
  - type: textarea
    id: risks
    attributes:
      label: 风险与限制
      description: 兼容性、安全、性能或交付限制。
    validations:
      required: false
```

创建 `.github/ISSUE_TEMPLATE/bug.yml`：

```yaml
name: Bug 报告
description: 报告一个可复现的软件缺陷
title: "fix: "
labels:
  - type:bug
  - status:ready
body:
  - type: markdown
    attributes:
      value: 请提供最小复现和可验证的预期行为。
  - type: textarea
    id: actual
    attributes:
      label: 当前行为
      description: 实际发生了什么？
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: 复现步骤
      description: 提供最小、稳定的复现步骤和输入。
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: 预期行为
      description: 正确结果应是什么？
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: 环境
      description: 浏览器、Node.js、操作系统或相关版本。
    validations:
      required: false
  - type: textarea
    id: acceptance
    attributes:
      label: 验收标准与原子任务
      placeholder: "- [ ] 回归测试与修复任务"
    validations:
      required: true
```

- [ ] **Step 5: 创建 PR 模板和 CI workflow**

创建 `.github/pull_request_template.md`：

```markdown
## Why

说明问题、影响和本次变更的动机。

Closes #

## What Changed

- 描述净变更及关键取舍。

## Atomic Tasks

- [ ] Issue 中的原子任务均已完成
- [ ] 每个 commit 聚焦且可审查

## Risk

- 描述兼容性、安全、性能或发布风险；没有则写“无已知风险”。

## Verification

- 描述针对行为的测试场景与结果。

## Review Gate

- [ ] 本地测试、类型检查和构建通过
- [ ] GitHub Actions 通过
- [ ] 已请求 Copilot review
- [ ] 有效 review comments 已解决
- [ ] Secret scanning 未发现阻塞问题
```

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Test
        run: npm test
      - name: Type check
        run: npm run check
      - name: Build
        run: npm run build
```

- [ ] **Step 6: 忽略 Agent 本地运行状态并验证 GREEN**

在 `.gitignore` 追加：

```gitignore
.superpowers/
```

Run:

```bash
npm test -- tests/unit/repository-governance.test.ts
```

Expected: `repository-governance.test.ts` 全部 PASS。

### Task 3: 创建全局 GitHub Delivery skill 并衔接 Git Commit skill

**Files:**
- Create: `/home/luwei/.codex/skills/github-delivery/SKILL.md`
- Create: `/home/luwei/.codex/skills/github-delivery/agents/openai.yaml`
- Modify: `/home/luwei/.codex/skills/git-commit/SKILL.md`

**Interfaces:**
- Consumes: Task 1 安装的官方 GitHub plugin、已配置 GitHub MCP、Task 2 的 `AGENTS.md`。
- Produces: `$github-delivery` 端到端交付编排器；`$git-commit` 返回原子提交结果但不重复 push。

- [ ] **Step 1: 运行失败的 skill 结构校验**

Run:

```bash
test ! -e /home/luwei/.codex/skills/github-delivery
python /home/luwei/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/luwei/.codex/skills/github-delivery
```

Expected: validator 以 `SKILL.md not found` 失败，证明目标尚未实现。若目录已存在，停止并转为审查更新，禁止覆盖。

- [ ] **Step 2: 使用官方初始化器创建 skill**

Run:

```bash
python /home/luwei/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  github-delivery \
  --path /home/luwei/.codex/skills \
  --interface 'display_name=GitHub Delivery' \
  --interface 'short_description=编排 Issue、原子提交、PR、Copilot 审核与自动合并' \
  --interface 'default_prompt=使用 $github-delivery 将当前非琐碎功能或修复按标准 GitHub 流程交付。'
```

Expected: 只创建 `SKILL.md` 和 `agents/openai.yaml`。

- [ ] **Step 3: 实现 github-delivery 工作流**

将 `/home/luwei/.codex/skills/github-delivery/SKILL.md` 写为：

```markdown
---
name: github-delivery
description: 按专业 GitHub 流程端到端交付非琐碎功能和 Bug 修复。实现 feat/fix、拆分原子任务、自动 commit/push、创建或关联 Issue、创建 PR、请求 Copilot review、处理 CI/review 并在门禁通过后自动合并时使用。
---

# GitHub Delivery 工作流

## 不可突破的边界

- 遵循当前请求、`AGENTS.md`、贡献指南和仓库模板；规则冲突时使用更严格的安全门禁。
- 禁止直接向默认分支 commit 或 push，禁止 force push、绕过 hooks和重写已推送历史。
- 只处理用户授权任务的文件与 GitHub 对象；工作区混有来源不明改动时停止并报告。
- GitHub 写操作前确认身份、owner、repo、Issue、branch 和 PR；token 只来自环境，不写入文件或输出。
- 外部状态无法确认时不自动合并，不把 PR 已创建描述成交付完成。

## 工具路由

- 优先使用官方 GitHub plugin 与 GitHub MCP 处理 Issue、PR、review、secret scanning 和 merge。
- 使用本地 `git` 管理分支、diff、commit 和 push。
- 仅用 `gh` 补足 GitHub Actions 日志、当前分支 PR 发现、仓库设置和 MCP 未覆盖的查询。
- CI 失败使用 `gh-fix-ci`；review feedback 使用 `gh-address-comments`；原子提交使用 `git-commit`。

## 1. 建立 Issue

1. 调用 GitHub MCP `get_me` 并解析当前仓库，确认写入目标。
2. 将任务分类为 `feat`、`fix`、`docs`、`chore` 或其他类型。
3. 非琐碎 `feat`/`fix` 先调用 `search_issues` 搜索重复项；复用同目标开放 Issue，否则用仓库模板创建 Issue。
4. Issue 包含背景、目标、验收标准、风险和原子任务 checklist，并应用 `type:*` 与状态标签。
5. 纯文档或琐碎维护仅在用户或仓库规则要求时创建 Issue。

## 2. 创建分支与原子任务

1. 获取远端默认分支并确认当前分支不是需要直接写入的默认分支。
2. 从最新默认分支创建 `feat/<issue-number>-<slug>` 或 `fix/<issue-number>-<slug>`；迁移已存在的本地提交时先建立可恢复分支引用。
3. 每个 checklist 项必须有单一目的、明确输出和独立验证命令。
4. 按依赖顺序实施原子任务；调用 `git-commit` 创建聚焦提交。
5. 每个原子任务验证和 commit 成功后立即 push 当前功能分支；push 失败时停止，不改写历史。

## 3. 创建和更新 PR

1. 首次 push 后检查当前分支是否已有 PR；存在则复用，不重复创建。
2. 读取仓库 PR template，创建目标为默认分支的 Draft PR。
3. PR 标题遵循 Conventional Commits，正文使用 `Closes #<issue-number>`，并记录原因、净变更、风险和行为验证。
4. 后续原子任务只更新同一 PR。所有 checklist 完成且本地门禁通过后，将 PR 转为 Ready。
5. 使用 GitHub MCP `request_copilot_review` 请求正式 Copilot review，不以普通评论替代。

## 4. Review 与 CI 闭环

1. 读取 reviews、requested changes 和 unresolved review threads，区分有效意见、信息和过时评论。
2. 对有效意见创建聚焦修复与测试，调用 `git-commit` 后 push；必要时重新请求 Copilot review。
3. 使用 GitHub Actions checks 验证 CI。失败时读取 Actions 日志，通过 `gh-fix-ci` 定位根因并按原子任务修复。
4. 疑似 flaky check 最多重试一次；再次失败按真实故障处理。
5. 分支冲突时合并最新默认分支到功能分支并验证，不 rebase 已推送提交。

## 5. 自动合并

仅在以下条件全部得到证据时调用 GitHub MCP `merge_pull_request` 并使用 squash：

- PR 已 Ready 且所有 Issue 原子任务完成；
- 本地验证与 GitHub Actions 全部成功；
- Copilot review 已完成且没有未解决的有效意见；
- PR 可合并且与默认分支无冲突；
- 对本次 diff 的 secret scanning 没有阻塞发现。

合并标题沿用 PR 标题，正文保留 Issue 关联。合并后确认 Issue 已关闭、远端功能分支已删除，再同步本地默认分支并删除本地功能分支。

## 完成汇报

- 报告 Issue、分支、原子 commit、PR 和 merge commit URL/SHA。
- 报告本地验证、CI、Copilot review、review threads 和 secret scanning 证据。
- 列出未完成或降级的门禁；存在任何未满足门禁时明确说明 PR 尚未合并。
```

- [ ] **Step 4: 为 git-commit 增加交付协作边界**

在 `/home/luwei/.codex/skills/git-commit/SKILL.md` 的“完成检查”前新增：

```markdown
## GitHub 交付协作

- 由 `github-delivery` 调用或适用的 `AGENTS.md` 要求发布时，完成原子提交后返回 commit SHA、信息、验证结果和剩余改动。
- `git-commit` 不自行创建 Issue、PR 或 review，也不与 `github-delivery` 重复 push。
- push、Copilot review、CI 闭环和 merge 统一由 `github-delivery` 控制。
```

- [ ] **Step 5: 验证两个 skills 的结构与行为契约**

Run:

```bash
python /home/luwei/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/luwei/.codex/skills/github-delivery
python /home/luwei/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/luwei/.codex/skills/git-commit
rg -n 'search_issues|request_copilot_review|GitHub Actions|secret scanning|merge_pull_request|禁止直接向默认分支' /home/luwei/.codex/skills/github-delivery/SKILL.md
rg -n 'github-delivery|不.*重复 push' /home/luwei/.codex/skills/git-commit/SKILL.md
```

Expected: 两次均输出 `Skill is valid!`；六类交付能力和 skill 职责边界均有匹配。

### Task 4: 验证、提交并自动 push 基础设施

**Files:**
- Commit: `AGENTS.md`
- Commit: `.gitignore`
- Commit: `.github/ISSUE_TEMPLATE/config.yml`
- Commit: `.github/ISSUE_TEMPLATE/feature.yml`
- Commit: `.github/ISSUE_TEMPLATE/bug.yml`
- Commit: `.github/pull_request_template.md`
- Commit: `.github/workflows/ci.yml`
- Commit: `tests/unit/repository-governance.test.ts`

**Interfaces:**
- Consumes: Task 2 的仓库配置、Task 3 的全局 skills。
- Produces: 一个验证通过的原子基础设施 commit 和已推送功能分支。

- [ ] **Step 1: 运行完整本地质量门禁**

Run:

```bash
npm test
npm run check
npm run build
```

Expected: 所有 Vitest 测试通过，Astro diagnostics 为 0 errors/0 warnings，生产构建成功。

- [ ] **Step 2: 检查 staged 边界并创建原子提交**

Run:

```bash
git status --short --branch
git add AGENTS.md .gitignore .github/ISSUE_TEMPLATE/config.yml .github/ISSUE_TEMPLATE/feature.yml .github/ISSUE_TEMPLATE/bug.yml .github/pull_request_template.md .github/workflows/ci.yml tests/unit/repository-governance.test.ts
git diff --cached --check
git diff --cached --stat
git commit -m 'ci: 建立标准化 GitHub 交付基础设施'
```

Expected: 只提交列出的治理、模板、CI 和测试文件；`.superpowers/` 不出现于 staged diff。

- [ ] **Step 3: 自动 push 功能分支**

Run:

```bash
delivery_issue_number="$(gh issue list --repo lwpk110/devformat-tools --state open --search 'Agent Harness GitHub 标准交付基础设施 in:title' --json number,title --jq 'map(select(.title == "feat: 建立 AI Agent GitHub 标准交付基础设施")) | if length == 1 then .[0].number else error("基础设施 Issue 不是唯一开放项") end')"
delivery_branch="feat/${delivery_issue_number}-agent-harness"
test "$(git branch --show-current)" = "$delivery_branch"
git push -u origin "$delivery_branch"
git ls-remote --exit-code --heads origin "$delivery_branch"
```

Expected: 远端功能分支存在并跟踪本地分支；远端 `main` 未改变。

### Task 5: 配置仓库合并策略并创建 PR

**Files:**
- Read: `.github/pull_request_template.md`

**Interfaces:**
- Consumes: Task 4 已推送的功能分支与基础设施 Issue。
- Produces: squash-only 仓库设置、单一 Ready PR、Copilot review 请求和 CI run。

- [ ] **Step 1: 幂等配置仓库合并策略**

Run:

```bash
gh api --method PATCH repos/lwpk110/devformat-tools \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true
gh repo view lwpk110/devformat-tools --json mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed,deleteBranchOnMerge
```

Expected: 仅 `squashMergeAllowed` 为 true，`deleteBranchOnMerge` 为 true。

- [ ] **Step 2: 创建唯一 Draft PR**

先通过 GitHub MCP `search_pull_requests` 搜索当前 head branch。不存在时读取 `.github/pull_request_template.md`，再调用：

```text
create_pull_request({
  owner: "lwpk110",
  repo: "devformat-tools",
  base: "main",
  head: delivery_branch,
  draft: true,
  title: "feat: 建立 AI Agent GitHub 标准交付基础设施",
  body: "## Why\n\n建立可复用的 Issue、原子任务、PR、Copilot review、CI 和自动合并闭环，避免 Agent 直接写入 main。\n\nCloses #" + String(delivery_issue_number) + "\n\n## What Changed\n\n- 安装并接入官方 GitHub plugin 与全局交付 skills。\n- 增加仓库 Agent 规则、Issue forms、PR template 和 CI。\n- 建立 Copilot review、secret scanning 与自动 squash merge 门禁。\n\n## Atomic Tasks\n\n- [x] Issue 中的原子任务均已完成\n- [x] 每个 commit 聚焦且可审查\n\n## Risk\n\n仓库未启用 branch protection，main 禁止直推依赖 Agent 流程约束。\n\n## Verification\n\n- npm test\n- npm run check\n- npm run build\n\n## Review Gate\n\n- [x] 本地测试、类型检查和构建通过\n- [ ] GitHub Actions 通过\n- [ ] 已请求 Copilot review\n- [ ] 有效 review comments 已解决\n- [ ] Secret scanning 未发现阻塞问题"
})
```

Expected: 获得唯一 Draft PR 编号 `delivery_pr_number` 和 URL。若当前分支已有 PR，复用并更新，不重复创建。

- [ ] **Step 3: 更新 Issue 原子任务状态**

使用 GitHub MCP `issue_read` 读取 Task 1 的 Issue 正文，保留背景、目标和风险，只对已经完成的 checklist 行执行以下确定性替换，再用 `issue_write(method: "update")` 写回完整正文：

```text
- [ ] 安装 OpenAI 官方 GitHub plugin
- [ ] 建立全局 github-delivery skill
- [ ] 更新 git-commit skill 的交付协作边界
- [ ] 增加仓库级 AGENTS.md
- [ ] 增加功能与 Bug Issue forms
- [ ] 增加 PR template
- [ ] 增加 GitHub Actions CI
```

替换为：

```text
- [x] 安装 OpenAI 官方 GitHub plugin
- [x] 建立全局 github-delivery skill
- [x] 更新 git-commit skill 的交付协作边界
- [x] 增加仓库级 AGENTS.md
- [x] 增加功能与 Bug Issue forms
- [x] 增加 PR template
- [x] 增加 GitHub Actions CI
```

Expected: 七个实施原子任务已勾选，Copilot review 和自动 merge 两个交付验收项仍未勾选。

- [ ] **Step 4: 将 PR 转为 Ready 并请求 Copilot review**

调用：

```text
update_pull_request({
  owner: "lwpk110",
  repo: "devformat-tools",
  pullNumber: delivery_pr_number,
  draft: false
})

request_copilot_review({
  owner: "lwpk110",
  repo: "devformat-tools",
  pullNumber: delivery_pr_number
})
```

Expected: PR 为 Ready，GitHub 显示 Copilot review 已请求。

- [ ] **Step 5: 等待 CI 并处理 review feedback**

Run:

```bash
gh pr checks "$delivery_pr_number" --repo lwpk110/devformat-tools --watch --interval 10
```

同时通过 GitHub MCP `pull_request_read` 获取 reviews、comments 和 review threads。若 CI 失败，使用官方 `gh-fix-ci`；若存在有效 unresolved feedback，使用 `gh-address-comments`，修复后执行相关本地验证、创建原子 commit、push 并重新请求 Copilot review。

Expected: GitHub Actions 全部成功，Copilot review 已完成且无有效 unresolved feedback。外部状态未满足时停止在开放 PR，不进入 Task 6。

- [ ] **Step 6: 更新 Copilot review 验收状态**

再次读取 Issue 正文，将：

```text
- [ ] 请求 Copilot review 并处理有效意见
```

替换为：

```text
- [x] 请求 Copilot review 并处理有效意见
```

通过 `issue_write(method: "update")` 写回完整正文。Expected: 仅“CI 与 secret scanning 通过后自动 squash merge”仍未勾选。

### Task 6: Secret scanning、自动合并与本地同步

**Files:**
- Verify: 本次 PR 的 `origin/main...HEAD` diff

**Interfaces:**
- Consumes: Task 5 的 `delivery_pr_number`、成功 CI 和已完成 Copilot review。
- Produces: 已 squash merge 的 PR、自动关闭的 Issue、删除的功能分支、与远端一致的本地 `main`。

- [ ] **Step 1: 对 PR diff 执行 secret scanning**

Run:

```bash
delivery_diff_path="$(mktemp /tmp/devformat-tools-agent-harness.XXXXXX.diff)"
git diff --binary origin/main...HEAD > "$delivery_diff_path"
test -s "$delivery_diff_path"
```

将 diff 内容按合理大小分块后传给 GitHub MCP：

```text
run_secret_scanning({
  owner: "lwpk110",
  repo: "devformat-tools",
  files: delivery_diff_chunks
})
```

其中 `delivery_diff_chunks: string[]` 是从 `delivery_diff_path` 读取并按工具输入限制切分的原始 diff 文本。Expected: 没有阻塞级 secret finding。扫描后执行 `rm "$delivery_diff_path"` 删除这个经过 `mktemp` 创建的精确临时文件；若 MCP 不可用，执行本地敏感信息扫描并在 PR 中记录保障降级。

- [ ] **Step 2: 最终确认 PR 可合并状态**

调用 GitHub MCP `pull_request_read` 获取 PR、reviews、comments、review threads 和 checks，并确认：Ready、mergeable、CI success、Copilot review complete、无有效 unresolved thread。

Run:

```bash
gh pr checks "$delivery_pr_number" --repo lwpk110/devformat-tools
```

Expected: 所有门禁均有成功证据；任一条件未知或失败时停止。

- [ ] **Step 3: 使用 GitHub MCP 自动 squash merge**

调用：

```text
merge_pull_request({
  owner: "lwpk110",
  repo: "devformat-tools",
  pullNumber: delivery_pr_number,
  merge_method: "squash",
  commit_title: "feat: 建立 AI Agent GitHub 标准交付基础设施",
  commit_message: "建立 Issue、原子任务、PR、Copilot review、CI 与自动合并的标准 Agent 交付流程。"
})
```

Expected: PR 状态为 merged，返回 merge commit SHA；关联 Issue 由 `Closes` 自动关闭，远端 head branch 自动删除。

- [ ] **Step 4: 更新最终 Issue 验收状态**

读取已关闭 Issue 正文，将：

```text
- [ ] CI 与 secret scanning 通过后自动 squash merge
```

替换为：

```text
- [x] CI 与 secret scanning 通过后自动 squash merge
```

通过 `issue_write(method: "update")` 写回完整正文，保留 `state: closed`。Expected: Issue 的九项 checklist 全部完成。

- [ ] **Step 5: 安全同步本地 main 并完成验收**

Run:

```bash
delivery_issue_number="$(gh issue list --repo lwpk110/devformat-tools --state closed --search 'Agent Harness GitHub 标准交付基础设施 in:title' --json number,title --jq 'map(select(.title == "feat: 建立 AI Agent GitHub 标准交付基础设施")) | if length == 1 then .[0].number else error("已关闭基础设施 Issue 不是唯一项") end')"
delivery_branch="feat/${delivery_issue_number}-agent-harness"
test "$(git branch --show-current)" = "$delivery_branch"
git fetch origin --prune
git diff --quiet origin/main "$delivery_branch"
test "$delivery_branch" != main
git branch -f main origin/main
git switch main
git branch -D "$delivery_branch"
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: 在确认 squash 后两个分支 tree 完全一致的前提下删除本地功能分支；本地 `main` 与 `origin/main` SHA 一致，工作区干净，Issue closed，PR merged。tree 不一致时在 `git branch -D` 前停止并保留分支。
