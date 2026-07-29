# Global Git Commit Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个用户级 `git-commit` skill，安全检查改动、自动拆分原子提交并遵循仓库提交规范。

**Architecture:** 使用纯指令型 `SKILL.md` 表达规范发现、风险检查、原子分组、验证、提交与 amend 决策，通过 `agents/openai.yaml` 暴露 UI 元数据。skill 不携带脚本或外部依赖，机械校验复用仓库已有工具和官方 skill validator。

**Tech Stack:** Codex Agent Skills、Markdown、YAML、Git CLI

## Global Constraints

- 安装位置固定为 `/home/luwei/.codex/skills/git-commit`。
- 默认只创建本地提交；用户未明确要求时禁止 push。
- 允许自动拆分多个原子提交。
- 仅允许自动 amend 已确认未推送、同一逻辑目的且不覆盖他人工作的 `HEAD`。
- 禁止自动 force push、reset、rebase、删除文件、修改已推送历史或绕过 Git hooks。
- 默认提交格式为 `<type>(<scope>): <中文描述>`，但用户指令和仓库规范优先。
- 不修改项目依赖或 Git 全局配置。

---

### Task 1: 初始化并实现用户级 skill

**Files:**
- Create: `/home/luwei/.codex/skills/git-commit/SKILL.md`
- Create: `/home/luwei/.codex/skills/git-commit/agents/openai.yaml`

**Interfaces:**
- Consumes: Codex 的 skills 自动发现机制、Git CLI、仓库级 `AGENTS.md` 与贡献文档。
- Produces: 可通过 `$git-commit` 显式调用、也可由提交类请求隐式触发的用户级 skill。

- [x] **Step 1: 验证目标尚不存在**

Run:

```bash
test ! -e /home/luwei/.codex/skills/git-commit
```

Expected: 退出码为 `0`，没有输出。若目录已经存在，停止并将任务转为更新现有 skill，禁止覆盖。

- [x] **Step 2: 使用官方初始化器创建最小目录结构**

Run:

```bash
python /home/luwei/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  git-commit \
  --path /home/luwei/.codex/skills \
  --interface 'display_name=Git Commit' \
  --interface 'short_description=安全检查改动、拆分逻辑分组并创建专业的原子 Git 提交' \
  --interface 'default_prompt=使用 $git-commit 检查当前改动并创建符合仓库规范的原子提交。'
```

Expected: 创建 `git-commit/SKILL.md` 和 `git-commit/agents/openai.yaml`，不创建 `scripts/`、`references/` 或 `assets/`。

- [x] **Step 3: 用完整工作流替换 SKILL.md 模板**

将 `/home/luwei/.codex/skills/git-commit/SKILL.md` 写为：

```markdown
---
name: git-commit
description: 安全检查、组织并提交 Git 改动。用户要求提交代码、创建 commit、整理或拆分原子提交、修正尚未推送的提交，或在提交前检查改动时使用；遵循仓库规范和 Conventional Commits，默认不 push。
---

# Git Commit 工作流

## 不可突破的边界

- 只处理用户授权范围内的改动，保留来源不明或无关的修改。
- 用户未明确要求时不 push；禁止自动 force push、reset、rebase、删除文件或修改已推送历史。
- 不使用 `--no-verify` 绕过 hooks，不降低测试、签名或仓库保护要求。
- 不泄露疑似密钥的内容；只报告文件路径、风险类型和必要的脱敏上下文。
- 验证失败、存在冲突或无法判断改动归属时停止对应提交并报告。

## 发现规范与状态

1. 使用 `git rev-parse --show-toplevel` 确认仓库根目录；不在 Git 仓库时停止。
2. 读取当前目录适用的 `AGENTS.md`、`CONTRIBUTING.md`、README 贡献章节和提交配置。
3. 运行 `git status --short --branch`、`git branch -vv`、`git remote -v` 和 `git log -10 --oneline`，了解分支、远端和近期风格。
4. 分别检查 `git diff`、`git diff --cached` 和 untracked 文件；尊重用户已有的 staged 边界。
5. 规范优先级为：用户当前指令、仓库约定、稳定的近期历史、默认规范。

默认使用 `<type>(<scope>): <中文描述>`。`scope` 可省略，常用类型为 `feat`、`fix`、`docs`、`refactor`、`test`、`build`、`ci` 和 `chore`。仓库明确采用其他语言或格式时服从仓库规范。

## 风险检查

- 检查 `.env`、凭证、token、私钥、证书、数据库转储、日志、依赖目录、构建产物和异常大型文件。
- 检查 `.gitignore` 是否覆盖明显的本地产物；不要仅为通过检查而擅自删除文件。
- 发现疑似敏感信息时不要暂存或输出其值，停止并告知用户处理建议。
- 检查 staged diff 确认没有调试代码、冲突标记或意外格式化噪音。

## 组织原子提交

1. 按用户可理解的功能目的和依赖关系划分改动，不按文件类型机械分组。
2. 将实现与直接验证该实现的测试放在同一提交，除非仓库明确要求独立测试提交。
3. 将独立的文档、重构、格式化和工具链变更拆开；拆分会破坏构建的紧密依赖改动保持同组。
4. 同一文件包含多个逻辑目的时，安全地使用 patch staging；无法可靠拆分时合并相关组或停止说明，禁止重写用户代码只为制造拆分。
5. 使用显式路径暂存。若必须调整混合的 staged 内容，只使用不改变 worktree 的 index 操作，并在操作前后复核 diff。
6. 无需为分组方案逐次请求确认；只要归属明确，即可按依赖顺序自动创建多个原子提交。

## 验证并提交

1. 从仓库文档、配置和已有脚本中选择每组改动最小且相关的测试、lint、类型检查或构建命令。
2. 提交前运行相关验证。缺少依赖或工具时报告；除非安装显然属于用户请求，否则不要擅自改变环境。
3. 验证通过后使用显式路径暂存，并用 `git diff --cached --check` 与 `git diff --cached` 复核。
4. 提交信息准确描述该组净变更，使用祈使语气，避免笼统的 `update`、`changes` 或无依据的 scope。
5. 创建提交后检查 `git show --stat --oneline HEAD`；继续下一逻辑组。

## Amend 决策

仅在以下条件全部满足时自动 amend `HEAD`：

- 新改动与 `HEAD` 是同一逻辑目的；
- 通过 upstream ahead/behind 和 remote contains 检查确认 `HEAD` 尚未推送；
- `HEAD` 不是其他作者的工作，且 amend 不覆盖用户未授权内容；
- 仓库没有禁止 amend 的约定。

无法确认远端状态、`HEAD` 已被任一远端分支包含或逻辑目的不一致时创建新提交。禁止为了 amend 已推送提交而自动 force push。

## 完成检查

- 运行 `git status --short --branch` 和 `git log --oneline`，确认历史与剩余改动符合授权范围。
- 报告每个 commit 的短 SHA、提交信息和对应验证结果。
- 明确列出未提交改动及原因。
- 仅当用户明确要求 push 时推送普通分支；推送失败时报告，不自动改写历史。
```

- [x] **Step 4: 检查生成的 UI 元数据**

确认 `/home/luwei/.codex/skills/git-commit/agents/openai.yaml` 内容为：

```yaml
interface:
  display_name: "Git Commit"
  short_description: "安全检查改动、拆分逻辑分组并创建专业的原子 Git 提交"
  default_prompt: "使用 $git-commit 检查当前改动并创建符合仓库规范的原子提交。"
```

- [x] **Step 5: 运行官方结构校验**

Run:

```bash
python /home/luwei/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /home/luwei/.codex/skills/git-commit
```

Expected: 输出 `Skill is valid!` 并以退出码 `0` 结束。

### Task 2: 验证安全与行为契约

**Files:**
- Verify: `/home/luwei/.codex/skills/git-commit/SKILL.md`
- Verify: `/home/luwei/.codex/skills/git-commit/agents/openai.yaml`

**Interfaces:**
- Consumes: Task 1 创建的 skill 文件。
- Produces: 对触发范围、提交格式、原子拆分、amend、验证失败和 push 边界的静态证据。

- [x] **Step 1: 检查 skill 中不存在模板占位符**

Run:

```bash
if rg -n 'TO[D]O|T[B]D|PLACE[H]OLDER|\[TO[D]O' /home/luwei/.codex/skills/git-commit; then
  exit 1
fi
```

Expected: 没有输出，退出码为 `0`。

- [x] **Step 2: 检查关键场景均有明确规则**

Run:

```bash
rg -n '自动创建多个原子提交|验证失败.*停止|尚未推送|已被任一远端分支包含|用户未明确要求时不 push|疑似敏感信息' \
  /home/luwei/.codex/skills/git-commit/SKILL.md
```

Expected: 六类约束均至少匹配一行；缺少任一类则补齐 `SKILL.md` 后重新校验。

- [x] **Step 3: 检查危险操作均被禁止**

Run:

```bash
rg -n 'force push|reset|rebase|删除文件|已推送历史|--no-verify' \
  /home/luwei/.codex/skills/git-commit/SKILL.md
```

Expected: 每个危险操作均出现在明确的禁止语境中。

- [x] **Step 4: 复核最终文件边界**

Run:

```bash
find /home/luwei/.codex/skills/git-commit -type f -printf '%P\n' | sort
```

Expected:

```text
SKILL.md
agents/openai.yaml
```

- [x] **Step 5: 再次运行官方校验并确认 Codex 可发现目录**

Run:

```bash
python /home/luwei/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /home/luwei/.codex/skills/git-commit
find /home/luwei/.codex/skills -maxdepth 2 -path '*/git-commit/SKILL.md' -print
```

Expected: 输出 `Skill is valid!`，并显示 `/home/luwei/.codex/skills/git-commit/SKILL.md`。Codex 通常会自动发现新 skill；若当前会话未刷新元数据，在新会话中使用 `$git-commit`。

### Task 3: 记录实施结果

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-git-commit-skill.md`

**Interfaces:**
- Consumes: Task 1–2 的实际执行与校验结果。
- Produces: 可审计的计划完成状态；全局 skill 本身不写入当前项目仓库。

- [x] **Step 1: 勾选已完成步骤并复核项目工作区**

Run:

```bash
git status --short --branch
```

Expected: 除本计划的完成标记外，没有来源不明的项目改动。

- [x] **Step 2: 提交计划完成记录**

Run:

```bash
git add docs/superpowers/plans/2026-07-29-git-commit-skill.md
git diff --cached --check
git commit -m "docs: 标记 Git Commit skill 实施完成"
```

Expected: 创建一个符合 Conventional Commits 的文档提交；不自动 push。
