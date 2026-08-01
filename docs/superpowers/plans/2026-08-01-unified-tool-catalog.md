# 统一工具目录与首页信息架构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一工具目录，使 ChatGPT Session Converter 与标准转换器在首页的精选和分类总目录中一致呈现。

**Architecture:** 新增 `src/data/toolCatalog.ts` 作为首页导航数据层。它把 `converters.json` 的标准转换器映射为目录条目，并显式注册 Session Converter；`src/pages/index.astro` 仅消费目录条目，而 `[slug].astro` 继续直接消费 `converters.json` 生成标准转换页面。

**Tech Stack:** Astro 4、TypeScript、Tailwind CSS、Vitest。

## Global Constraints

- `src/data/converters.json` 和 `ConverterData` 继续只负责标准格式转换器与其静态路由。
- 工具目录条目使用 `id`、`name`、`description`、`href`、`category`、`categoryRank`、`homepageRank`、`kind`。
- 首页的工具数、精选工具、分类和分类内排序均从工具目录派生，禁止首页手写 Session 特例。
- ChatGPT Session Converter 位于 `Account & Session` 分类，`categoryRank` 为 1，且 `homepageRank` 为 1。
- 不执行 Cloudflare 发布、push、PR、merge 或修改生产数据。

---

### Task 1: 建立可测试的统一工具目录

**Files:**
- Create: `src/data/toolCatalog.ts`
- Create: `tests/unit/tool-catalog.test.ts`

**Interfaces:**
- Consumes: `src/data/converters.json` 与 `ConverterData`。
- Produces: `ToolCatalogEntry`、`toolCatalog`、`popularTools`、`toolCategories`。

- [ ] **Step 1: Write the failing test**

```ts
import { toolCatalog, toolCategories, popularTools } from '../../src/data/toolCatalog';

it('目录收录全部标准转换器和 ChatGPT Session Converter', () => {
  expect(toolCatalog).toHaveLength(10);
  expect(toolCatalog).toContainEqual(expect.objectContaining({
    id: 'chatgpt-session-converter',
    href: '/session-converter/',
    category: 'Account & Session',
    categoryRank: 1,
    homepageRank: 1,
    kind: 'session',
  }));
});

it('精选和分类使用显式排序', () => {
  expect(popularTools[0].id).toBe('chatgpt-session-converter');
  expect(toolCategories[0].name).toBe('Account & Session');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/tool-catalog.test.ts`

Expected: FAIL，原因是 `src/data/toolCatalog.ts` 尚不存在。

- [ ] **Step 3: Write the minimal catalog implementation**

```ts
export interface ToolCatalogEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  category: string;
  categoryRank: number;
  homepageRank?: number;
  kind: 'converter' | 'session';
}

export const toolCatalog = [sessionTool, ...converterTools].sort(compareTools);
export const popularTools = toolCatalog.filter((tool) => tool.homepageRank !== undefined).sort(compareHomepageRank);
export const toolCategories = groupByCategory(toolCatalog);
```

`converterTools` 必须由 `converters.json` 映射而来，名称使用现有 `directions` 构造的转换名称，href 使用 `/convert/${slug}/`；分类排序通过显式映射表给出，禁止依赖 JSON 数组顺序。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/tool-catalog.test.ts`

Expected: PASS。

### Task 2: 将首页改为消费统一目录

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `tests/unit/seo-contract.test.ts`

**Interfaces:**
- Consumes: `toolCatalog`、`popularTools`、`toolCategories`。
- Produces: 由统一目录生成的工具数、精选区和分类 `All tools`。

- [ ] **Step 1: Write the failing source contract**

```ts
it('首页从统一工具目录渲染精选和 All tools', () => {
  const source = readFileSync('src/pages/index.astro', 'utf8');
  expect(source).toContain("from '../data/toolCatalog'");
  expect(source).toContain('popularTools');
  expect(source).toContain('toolCategories');
  expect(source).not.toContain('id="session-tools"');
  expect(source).not.toContain('Session & account tools');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/seo-contract.test.ts`

Expected: FAIL，因为首页当前仍直接导入 `converters.json` 并有独立 Session 区块。

- [ ] **Step 3: Rewrite homepage data consumption**

替换首页开头的数据推导为：

```ts
import { popularTools, toolCatalog, toolCategories } from '../data/toolCatalog';

const toolCount = toolCatalog.length;
```

`Popular conversions` 重命名为 `Popular tools`，卡片统一使用 `tool.href`、`tool.name` 与 `tool.description`。`All tools` 循环 `toolCategories`，分类标题使用 `category.name`，链接循环 `category.tools`。首屏工具数使用 `{toolCount}`。删除整个 `id="session-tools"` 区块。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/seo-contract.test.ts`

Expected: PASS。

### Task 3: 验证回归与本地人工审核

**Files:**
- No additional files.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/unit/tool-catalog.test.ts tests/unit/seo-contract.test.ts`

Expected: PASS，且 Session Converter 同时出现在精选和 `Account & Session`。

- [ ] **Step 2: Run full quality gates**

Run: `npm test && npm run check && npm run build`

Expected: 全部通过，标准转换路由仍由 `converters.json` 构建。

- [ ] **Step 3: Start local review server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: 提供本地首页 URL，用人工方式确认精选区、`Account & Session` 分类和链接正常；不执行任何 Cloudflare 命令。
