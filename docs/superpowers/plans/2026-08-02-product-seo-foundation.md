# Product SEO Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 明确首页的本地开发者格式转换定位，并以稳定、可解释的规则连接语义相关的现有转换工具。

**Architecture:** `src/data/relatedTools.ts` 只依赖 `ConverterData`，计算分类与格式交集的确定性分数，不接触页面或 Session 工具。Astro 转换页使用选择器渲染既有 Related tools 区域；首页只替换元数据和首屏文案，继续由既有统一工具目录提供链接。

**Tech Stack:** TypeScript、Astro 4、Vitest、GitHub Actions、Cloudflare Pages。

## Global Constraints

- 只优化既有 canonical 页面，不增加 converter、路由、账号、广告、上传或服务端内容处理。
- Related tools 仅接受标准 `ConverterData[]`，必须排除当前工具，最多返回 4 项，禁止引入 Session Converter。
- 相关性为同 category 加 4 分；任一 direction 的 `from` 或 `to` 格式有交集加 2 分；同分按 `slug` 升序。
- 首页固定使用 title `Free Online Developer Converters - Private JSON, CSV, YAML & More`。
- 首页固定使用 description `Free online developer converters for JSON, CSV, YAML, XML, Base64, timestamps and URL encoding. Fast, private browser tools with no uploads or signup.`。
- 不改变 canonical、robots.txt、sitemap、JSON-LD、Popular tools 排序或本地隐私承诺。
- 每个原子任务验证、提交后立即 push；禁止向 `main` 直接提交或推送。

---

## File Structure

- 新建 `src/data/relatedTools.ts`：纯函数 `selectRelatedTools` 及相关性评分。
- 新建 `tests/unit/related-tools.test.ts`：选择器的排序、排除与数量行为测试。
- 修改 `src/pages/convert/[slug].astro`：使用选择器替代 JSON 数据源的数组顺序切片。
- 修改 `src/pages/index.astro`：更新首页 title、description 与首屏英文定位文案。
- 修改 `tests/unit/seo-contract.test.ts`：锁定 selector 接入和首页源文案契约。
- 修改 `tests/build/dist.test.ts`：锁定首页构建产物的 title、description 和 H1。

### Task 1: Semantic Related Tools Selector

**Files:**
- Create: `src/data/relatedTools.ts`
- Create: `tests/unit/related-tools.test.ts`
- Modify: `src/pages/convert/[slug].astro:1-31`

**Interfaces:**
- Consumes: `ConverterData` from `src/types/converter.ts`.
- Produces: `selectRelatedTools(current: ConverterData, candidates: ConverterData[]): ConverterData[]`.

- [ ] **Step 1: Write the failing selector tests**

Create `tests/unit/related-tools.test.ts` with fixture constructors and these assertions:

```ts
import { describe, expect, it } from 'vitest';

import { selectRelatedTools } from '../../src/data/relatedTools';
import type { ConverterData } from '../../src/types/converter';

function tool(slug: string, category: string, formats: string[]): ConverterData {
  return {
    slug, category, title: slug, description: slug,
    directions: [{ id: slug, from: formats[0], to: formats[1] ?? formats[0], sampleInput: '', sampleOutput: '', downloadExtension: 'txt', summary: slug }],
    faq: [],
  };
}

describe('selectRelatedTools', () => {
  it('优先选择同分类工具，再选择共享格式工具', () => {
    const current = tool('json-csv', 'Data', ['JSON', 'CSV']);
    const related = selectRelatedTools(current, [
      tool('yaml-xml', 'Data', ['YAML', 'XML']),
      tool('json-go', 'Type Generators', ['JSON', 'Go']),
      tool('base64', 'Encoding', ['Text', 'Base64']),
    ]);

    expect(related.map(({ slug }) => slug)).toEqual(['yaml-xml', 'json-go', 'base64']);
  });

  it('排除当前工具并按 slug 稳定处理同分候选', () => {
    const current = tool('json-csv', 'Data', ['JSON', 'CSV']);
    const related = selectRelatedTools(current, [
      current,
      tool('zeta', 'Encoding', ['Text', 'Base64']),
      tool('alpha', 'Encoding', ['Text', 'Base64']),
    ]);

    expect(related.map(({ slug }) => slug)).toEqual(['alpha', 'zeta']);
  });

  it('最多返回四个工具', () => {
    const current = tool('json-csv', 'Data', ['JSON', 'CSV']);
    const related = selectRelatedTools(current, [
      tool('one', 'Data', ['One', 'Two']), tool('two', 'Data', ['Three', 'Four']),
      tool('three', 'Data', ['Five', 'Six']), tool('four', 'Data', ['Seven', 'Eight']),
      tool('five', 'Data', ['Nine', 'Ten']),
    ]);

    expect(related).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run: `npm test -- tests/unit/related-tools.test.ts`

Expected: FAIL because module `../../src/data/relatedTools` does not exist.

- [ ] **Step 3: Implement the minimal selector and connect the converter page**

Create `src/data/relatedTools.ts`:

```ts
import type { ConverterData } from '../types/converter';

function formats(converter: ConverterData): Set<string> {
  return new Set(converter.directions.flatMap(({ from, to }) => [from, to]));
}

export function selectRelatedTools(current: ConverterData, candidates: ConverterData[]): ConverterData[] {
  const currentFormats = formats(current);

  return candidates
    .filter(({ slug }) => slug !== current.slug)
    .map((candidate) => {
      const sharesFormat = [...formats(candidate)].some((format) => currentFormats.has(format));
      const score = (candidate.category === current.category ? 4 : 0) + (sharesFormat ? 2 : 0);
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score || left.candidate.slug.localeCompare(right.candidate.slug))
    .slice(0, 4)
    .map(({ candidate }) => candidate);
}
```

In `src/pages/convert/[slug].astro`, add:

```ts
import { selectRelatedTools } from '../../data/relatedTools';
```

and replace:

```ts
const related = converters.filter(({ slug }) => slug !== converter.slug).slice(0, 4);
```

with:

```ts
const related = selectRelatedTools(converter, converters);
```

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm test -- tests/unit/related-tools.test.ts tests/unit/seo-contract.test.ts`

Expected: PASS; the existing converter source contract remains valid.

- [ ] **Step 5: Commit and push the atomic change**

Run:

```bash
git add src/data/relatedTools.ts src/pages/convert/'[slug]'.astro tests/unit/related-tools.test.ts
git diff --cached --check
git commit -m 'feat(seo): 按语义关联相关转换工具'
git push
```

Expected: 一个可独立验证的 selector 提交推送到 `feat/33-product-seo-foundation`。

### Task 2: Homepage Positioning and Static SEO Contract

**Files:**
- Modify: `src/pages/index.astro:8-25`
- Modify: `tests/unit/seo-contract.test.ts:51-64`
- Modify: `tests/build/dist.test.ts:56-64`

**Interfaces:**
- Consumes: Task 1 的 `selectRelatedTools` 已接入 converter 页面。
- Produces: 静态首页输出明确的 developer format converter title、description 和 H1，且其余工具目录接口不变。

- [ ] **Step 1: Write failing source and build contracts**

Add this test to `tests/unit/seo-contract.test.ts`:

```ts
  it('首页定位为本地优先的开发者格式转换工具', () => {
    const source = readFileSync('src/pages/index.astro', 'utf8');

    expect(source).toContain('Free Online Developer Converters - Private JSON, CSV, YAML & More');
    expect(source).toContain('Free online developer converters for JSON, CSV, YAML, XML, Base64, timestamps and URL encoding. Fast, private browser tools with no uploads or signup.');
    expect(source).toContain('Local-first developer converters');
    expect(source).toContain('Private developer format converters.');
    expect(source).toContain('JSON, CSV, YAML, XML, encoding, and timestamps');
  });
```

Add this assertion to the `首页无需 JavaScript 即包含全部工具链接` test in `tests/build/dist.test.ts`:

```ts
    expect(html).toContain('<title>Free Online Developer Converters - Private JSON, CSV, YAML &amp; More</title>');
    expect(html).toContain('name="description" content="Free online developer converters for JSON, CSV, YAML, XML, Base64, timestamps and URL encoding. Fast, private browser tools with no uploads or signup."');
    expect(html).toContain('<h1 class="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-stone-950 sm:text-7xl lg:text-[5.4rem]">Private developer format converters.</h1>');
```

- [ ] **Step 2: Run source contract to verify RED**

Run: `npm test -- tests/unit/seo-contract.test.ts`

Expected: FAIL because the homepage still has the prior title and first-screen copy.

- [ ] **Step 3: Update only homepage metadata and first-screen copy**

In `src/pages/index.astro`, use the following exact values:

```astro
<Layout
  title="Free Online Developer Converters - Private JSON, CSV, YAML & More"
  description="Free online developer converters for JSON, CSV, YAML, XML, Base64, timestamps and URL encoding. Fast, private browser tools with no uploads or signup."
  canonical="/"
>
```

```astro
<p class="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">Local-first developer converters</p>
<h1 class="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-stone-950 sm:text-7xl lg:text-[5.4rem]">
  Private developer format converters.
</h1>
<p class="mt-7 max-w-2xl text-lg leading-8 text-stone-600 sm:text-xl">
  Convert JSON, CSV, YAML, XML, encoding, and timestamps entirely in your browser. No uploads, accounts, or waiting for a server.
</p>
```

Do not alter `popularTools`, `toolCategories`, the service guarantees, anchors, or existing CSS classes.

- [ ] **Step 4: Run source and generated-output tests to verify GREEN**

Run:

```bash
npm test -- tests/unit/seo-contract.test.ts
npm run build
npm test -- tests/build/dist.test.ts
```

Expected: source contract and generated static homepage contract PASS; build regenerates `dist/` without errors.

- [ ] **Step 5: Commit and push the atomic change**

Run:

```bash
git add src/pages/index.astro tests/unit/seo-contract.test.ts tests/build/dist.test.ts
git diff --cached --check
git commit -m 'feat(seo): 明确开发者转换工具首页定位'
git push
```

Expected: 首页定位及其静态产物契约位于单一提交并推送到远端分支。

### Task 3: Delivery Verification and GitHub Completion

**Files:**
- No repository source changes expected.

**Interfaces:**
- Consumes: Task 1 and Task 2 committed changes.
- Produces: Issue #33 closed through a squash-merged PR and local `main` synchronized with remote.

- [ ] **Step 1: Run all repository gates**

Run:

```bash
npm run build
npm test
npm run check
npm run verify:build
git diff --check
```

Expected: every command exits 0; `git diff --check` reports no whitespace error.

- [ ] **Step 2: Create or update the draft PR**

Run `gh pr create --draft --base main --head feat/33-product-seo-foundation` with title `feat: 优化本地开发者工具站的产品定位与站内 SEO` and a Chinese body that contains `Closes #33`, motivation, changes, risks, verification, and Agent Delivery Status. If a PR already exists, update that PR instead of creating another.

Expected: exactly one open PR from the feature branch, linked to Issue #33.

- [ ] **Step 3: Mark ready and request Copilot review**

Run:

```bash
gh pr ready <PR_NUMBER>
gh api --method POST repos/lwpk110/devformat-tools/pulls/<PR_NUMBER>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
gh api repos/lwpk110/devformat-tools/pulls/<PR_NUMBER>/requested_reviewers --jq '.users | map(.login)'
```

Expected: the final command includes `Copilot`; do not use `gh pr create --reviewer Copilot`.

- [ ] **Step 4: Resolve actionable feedback and rerun gates**

For each Copilot review thread, classify it as actionable or explain why it is not. For every actionable item, first add a failing regression test, run it to observe RED, make the minimal fix, run its focused test GREEN, commit, push, and resolve its review thread. Re-run the five Step 1 commands after the final feedback change.

Expected: no unresolved actionable review thread and all repository gates pass.

- [ ] **Step 5: Squash merge and verify the closure**

After CI is successful, Copilot review is complete, the PR reports `CLEAN` and mergeable, run:

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
git checkout main
git pull --ff-only origin main
git branch -d feat/33-product-seo-foundation
gh issue view 33 --json state --jq .state
```

Expected: PR merged, remote feature branch deleted, Issue #33 reports `CLOSED`, and local `main` equals `origin/main`.

## Self-Review

- Spec coverage: Task 1 implements deterministic semantic internal linking without Session tools; Task 2 implements the approved homepage positioning; Task 3 verifies canonical-sensitive outputs and GitHub delivery. No approved requirement is omitted.
- Placeholder scan: this plan contains no incomplete markers, deferred implementation, or unspecified code step.
- Type consistency: all production callers use `selectRelatedTools(current: ConverterData, candidates: ConverterData[]): ConverterData[]`; the selector consumes only fields declared on `ConverterData` and no task references a different function name.
