# Base64 Encode Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不降低 100ms 预算的前提下优化浏览器 Base64 编码路径，并通过独立 Issue #2、PR、Copilot review、CI 和 secret scanning 完成交付。

**Architecture:** 保留 `TextEncoder` 与 `btoa` 的浏览器语义，将逐 byte 字符串拼接替换为 32768-byte chunk 转换和片段 join。修复在隔离 worktree 的 `fix/2-base64-performance` 分支完成，合并后再恢复 Agent Harness Issue #1。

**Tech Stack:** TypeScript、Web Platform API、Vitest、Astro、GitHub MCP、GitHub Actions

## Global Constraints

- 不修改 `tests/unit/converter-performance.test.ts` 的 100ms 阈值、1MB 输入、预热或 7 次采样。
- 不使用 Node.js `Buffer`，不引入新依赖或运行时环境判断。
- 保持 `encodeBase64(input: string): string` API、UTF-8 行为和空输入错误不变。
- 不修改 `decodeBase64`。
- 所有改动仅存在于 Issue #2 的 worktree 和分支，不触碰 Issue #1 的未提交文件。
- 必须通过完整测试、类型检查、构建、Copilot review、CI 和 secret scanning 后才允许 squash merge。

---

### Task 1: 建立 RED 性能证据与 chunk 边界契约

**Files:**
- Modify: `tests/unit/converters.test.ts`
- Verify: `tests/unit/converter-performance.test.ts`

**Interfaces:**
- Consumes: 现有 `convert('base64-encode', input)` 与 `convert('base64-decode', input)`。
- Produces: 大于 32768 bytes 的 Unicode round-trip 回归契约；当前实现超过 100ms 的 RED 性能证据。

- [ ] **Step 1: 安装锁定依赖**

Run:

```bash
npm ci
```

Expected: 根据 `package-lock.json` 安装依赖，tracked files 不变化。

- [ ] **Step 2: 在隔离 worktree 复现性能 RED**

Run:

```bash
npm test -- tests/unit/converter-performance.test.ts
```

Expected: `base64-encode` 中位耗时不低于 100ms 并导致 FAIL。该结果与主 worktree 已记录的 116ms 重试失败共同构成 RED 证据；若本次因瞬时负载较低而通过，保留主 worktree 的已观察 RED，不重复运行制造失败。

- [ ] **Step 3: 添加 Unicode chunk 边界特征测试**

在 `tests/unit/converters.test.ts` 的 Base64 测试后增加：

```typescript
  it('Base64 对跨 chunk 的 Unicode 文本保持可逆', () => {
    const input = '开发者🚀'.repeat(8192)
    const encoded = convert('base64-encode', input)

    expect(convert('base64-decode', encoded)).toBe(input)
  })
```

- [ ] **Step 4: 运行功能测试确认现有语义基线**

Run:

```bash
npm test -- tests/unit/converters.test.ts
```

Expected: 新增 Unicode round-trip 与全部转换器功能测试 PASS。该测试是对已有正确语义的特征锁定，性能 RED 仍来自 Step 2。

### Task 2: 最小化实现 chunk 编码

**Files:**
- Modify: `src/lib/converters/base64.ts`
- Test: `tests/unit/converters.test.ts`
- Test: `tests/unit/converter-performance.test.ts`

**Interfaces:**
- Consumes: `Uint8Array` 与固定常量 `BINARY_CHUNK_SIZE = 0x8000`。
- Produces: `bytesToBinary(bytes: Uint8Array): string`；保持原 `encodeBase64` 公共签名。

- [ ] **Step 1: 实现最小 chunk 转换**

将 `src/lib/converters/base64.ts` 的编码部分改为：

```typescript
import { ConversionError } from './utils'

const BINARY_CHUNK_SIZE = 0x8000

function bytesToBinary(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BINARY_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BINARY_CHUNK_SIZE)
    chunks.push(String.fromCharCode(...chunk))
  }
  return chunks.join('')
}

export function encodeBase64(input: string): string {
  if (!input) throw new ConversionError('请输入要编码的文本')
  return btoa(bytesToBinary(new TextEncoder().encode(input)))
}
```

保留文件中现有 `decodeBase64` 原样。

- [ ] **Step 2: 验证功能 GREEN**

Run:

```bash
npm test -- tests/unit/converters.test.ts
```

Expected: 全部转换器功能测试 PASS，包括 ASCII、中文和跨 chunk Unicode round-trip。

- [ ] **Step 3: 验证性能 GREEN**

Run:

```bash
npm test -- tests/unit/converter-performance.test.ts
```

Expected: 15 项性能测试全部 PASS，`base64-encode` 中位耗时低于 100ms。若首次失败，最多重试一次；再次失败则停止，不调整阈值。

- [ ] **Step 4: 复核实现边界**

Run:

```bash
git diff --check
git diff -- src/lib/converters/base64.ts tests/unit/converters.test.ts
rg -n 'Buffer|BINARY_CHUNK_SIZE|bytesToBinary' src/lib/converters/base64.ts
```

Expected: diff 无空白错误；`Buffer` 无匹配；chunk 常量和 helper 各有清晰定义与调用。

### Task 3: 完整验证、原子提交和 push

**Files:**
- Create: `.github/workflows/ci.yml`
- Commit: `docs/superpowers/specs/2026-07-29-base64-encode-performance-design.md`
- Commit: `docs/superpowers/plans/2026-07-29-base64-encode-performance.md`
- Commit: `src/lib/converters/base64.ts`
- Commit: `tests/unit/converters.test.ts`

**Interfaces:**
- Consumes: Task 2 的功能与性能 GREEN。
- Produces: 已验证、已推送的 `fix/2-base64-performance` 分支。

- [ ] **Step 1: 增加 clean checkout CI bootstrap**

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
      - name: Build
        run: npm run build
      - name: Test
        run: npm test
      - name: Type check
        run: npm run check
```

Run:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; import { parse } from 'yaml'; const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8')); if (workflow.jobs.quality.steps.map((step) => step.run).filter(Boolean).join(',') !== 'npm ci,npm run build,npm test,npm run check') process.exit(1)"
```

Expected: YAML 可解析，命令顺序严格为 clean checkout 可执行的 `install → build → test → check`。

- [ ] **Step 2: 运行完整质量门禁**

Run:

```bash
npm run build
npm test
npm run check
```

Expected: 全部测试 PASS，Astro diagnostics 为 0 errors/0 warnings，生产构建成功。

- [ ] **Step 3: 创建聚焦修复提交**

Run:

```bash
git add src/lib/converters/base64.ts tests/unit/converters.test.ts
git diff --cached --check
git commit -m 'fix(base64): 优化大文本编码性能' -m 'Refs #2'
```

Expected: 创建只包含实现和直接测试的原子 commit；设计文档提交与实施提交保持分离。

- [ ] **Step 4: 创建 CI 提交并自动 push 性能分支**

Run:

```bash
git add .github/workflows/ci.yml
git diff --cached --check
git commit -m 'ci: 修正 clean checkout 质量门禁顺序' -m 'Refs #1, #2'
git push -u origin fix/2-base64-performance
git ls-remote --exit-code --heads origin fix/2-base64-performance
```

Expected: 远端分支存在并跟踪本地分支；远端 `main` 未改变。

### Task 4: PR、Copilot review、CI 与自动合并

**Files:**
- Verify: `.github/pull_request_template.md`（远端 `main` 尚无该文件时使用计划内标准正文）

**Interfaces:**
- Consumes: Issue #2、已推送分支、完整本地门禁。
- Produces: merged PR、关闭的 Issue #2、删除的远端分支和最新 `origin/main`。

- [ ] **Step 1: 创建 Ready PR**

使用 GitHub MCP 搜索当前分支 PR；不存在时调用：

```text
create_pull_request({
  owner: "lwpk110",
  repo: "devformat-tools",
  base: "main",
  head: "fix/2-base64-performance",
  draft: false,
  title: "fix(base64): 优化大文本编码性能",
  body: "## Why\n\n1MB Base64 编码在重试后仍超过 100ms 性能预算，阻塞完整质量门禁。\n\nCloses #2\n\n## What Changed\n\n- 将逐 byte 字符串拼接替换为固定大小 chunk 转换。\n- 增加跨 chunk Unicode round-trip 测试。\n\n## Risk\n\n保持 TextEncoder 与 btoa 浏览器语义，不引入 Buffer 或依赖。\n\n## Verification\n\n- npm test\n- npm run check\n- npm run build"
})
```

Expected: 获得唯一 Ready PR 编号 `performance_pr_number`。

- [ ] **Step 2: 请求 Copilot review 并等待 CI**

调用 GitHub MCP：

```text
request_copilot_review({
  owner: "lwpk110",
  repo: "devformat-tools",
  pullNumber: performance_pr_number
})
```

Run:

```bash
gh pr checks "$performance_pr_number" --repo lwpk110/devformat-tools --watch --interval 10
```

Expected: CI 全部成功，Copilot review 完成。有效 feedback 使用 `gh-address-comments` 处理，修复后重新验证、commit、push 并重新请求 review。

- [ ] **Step 3: 扫描 PR diff 并确认 merge 门禁**

Run:

```bash
performance_diff_path="$(mktemp /tmp/devformat-tools-base64.XXXXXX.diff)"
git diff --binary origin/main...HEAD > "$performance_diff_path"
test -s "$performance_diff_path"
```

将原始 diff 文本分块传给 GitHub MCP `run_secret_scanning`。同时读取 PR reviews、threads、checks 和 mergeable 状态。Expected: 无 secret finding、无有效 unresolved feedback、CI success、PR 可合并。完成后删除 `performance_diff_path` 指向的精确临时文件。

- [ ] **Step 4: 自动 squash merge 并更新 Issue**

调用：

```text
merge_pull_request({
  owner: "lwpk110",
  repo: "devformat-tools",
  pullNumber: performance_pr_number,
  merge_method: "squash",
  commit_title: "fix(base64): 优化大文本编码性能",
  commit_message: "通过固定大小 chunk 转换稳定 1MB Base64 编码性能预算。"
})
```

Expected: PR merged，Issue #2 closed。若远端功能分支仍存在，运行 `git push origin --delete fix/2-base64-performance` 删除该精确分支。读取 Issue #2 正文，将七个验收 checklist 更新为完成并保留 closed 状态。

- [ ] **Step 5: 同步性能 worktree**

Run:

```bash
git fetch origin --prune
git diff --quiet origin/main fix/2-base64-performance
git branch -f main origin/main
```

Expected: squash 后功能分支与 `origin/main` tree 一致。保留 worktree 到 Issue #1 完成恢复验证后再安全移除。

### Task 5: 恢复 Agent Harness Issue #1

**Files:**
- Verify: `/home/luwei/workspace/github/devformat-tools`

**Interfaces:**
- Consumes: 已包含 Base64 修复的 `origin/main`；Issue #1 的 `feat/1-agent-harness` worktree。
- Produces: 合并最新主分支且完整门禁通过的 Agent Harness 分支。

- [ ] **Step 1: 将最新 main 合入 Issue #1 分支**

Run:

```bash
git fetch origin --prune
test "$(git branch --show-current)" = feat/1-agent-harness
git merge --no-edit origin/main
```

Expected: 合并成功且不覆盖 Issue #1 未提交的治理文件；出现冲突时停止并逐项审查。

- [ ] **Step 2: 重新运行 Agent Harness 完整门禁**

Run:

```bash
npm test
npm run check
npm run build
```

Expected: Base64 性能测试和全部项目门禁通过，随后恢复 Agent Harness 主实施计划 Task 4。
