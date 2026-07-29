# DevFormat.tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建符合 PRD 的 Astro 全静态开发者转换工具站，交付 5 个浏览器内转换页面、完整 SEO 产物和自动化验收。

**Architecture:** `converters.json` 驱动 Astro SSG 路由与静态 SEO 正文，单一 React island 承载交互。纯 TypeScript converter registry 将 slug 映射到无 DOM/网络依赖的转换函数，Vitest 分层验证数据、算法、组件与 `dist/`。

**Tech Stack:** Node.js >=18、Astro 4、React 18、Tailwind CSS 3、TypeScript、Vitest、Testing Library、`@astrojs/sitemap`

## Global Constraints

- 所有转换逻辑只能在浏览器中执行，不允许 HTTP POST、后端 API 或用户内容持久化。
- `src/data/converters.json` 必须包含 5 个唯一 slug，并作为页面矩阵唯一事实来源。
- 每个转换页面必须静态生成，并包含 canonical、OpenGraph、SoftwareApplication JSON-LD 和 FAQ 正文。
- 1MB 输入转换耗时必须小于 100ms；部署环境 LCP 必须不超过 1.2 秒。
- 新行为严格执行 RED→GREEN→REFACTOR，先观察测试因缺失行为失败，再编写最小实现。

---

## 文件结构

- `package.json`、`astro.config.mjs`、`tsconfig.json`、`tailwind.config.mjs`：独立应用与质量脚本。
- `src/types/converter.ts`、`src/data/converters.json`：公开数据契约与页面矩阵。
- `src/lib/converters/*.ts`：错误模型、公共推断和五个目标格式纯函数。
- `src/components/ConverterTool.tsx`：唯一 hydrated island；其余 `.astro` 组件为静态展示。
- `src/layouts/Layout.astro`、`src/pages/**`：统一 SEO、首页、静态动态路由和 robots。
- `tests/unit/**`、`tests/component/**`、`tests/build/**`：算法、交互、静态产物与性能证据。

### Task 1: 项目配置与 converter 数据契约

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `tailwind.config.mjs`, `src/env.d.ts`
- Create: `src/types/converter.ts`, `src/data/converters.json`
- Test: `tests/unit/converters-data.test.ts`

**Interfaces:**
- Produces: `ConverterData`, `FAQItem`；5 个可由 JSON import 的 converter 条目。

- [ ] **Step 1: 建立最小测试运行配置并写失败的数据契约测试**

```ts
import converters from '../../src/data/converters.json';

it('提供 5 个字段完整且 slug 唯一的 converter', () => {
  expect(converters).toHaveLength(5);
  expect(new Set(converters.map(({ slug }) => slug)).size).toBe(5);
  expect(converters.every((item) => item.faq.length > 0)).toBe(true);
});
```

- [ ] **Step 2: 运行 RED**

Run: `npm test -- tests/unit/converters-data.test.ts`
Expected: FAIL，原因是 `src/data/converters.json` 不存在。

- [ ] **Step 3: 创建接口、5 项数据和 Astro 配置**

```ts
export interface FAQItem { q: string; a: string }
export interface ConverterData {
  slug: string; from: string; to: string; category: string;
  title: string; description: string; sampleInput: string;
  sampleOutput: string; faq: FAQItem[];
}
```

配置 `site: 'https://devformat.tools'`、`output: 'static'`、React/Tailwind/sitemap integrations，并在 `package.json` 提供 `dev`、`build`、`test`、`check`、`verify:build` 脚本。

- [ ] **Step 4: 运行 GREEN 与类型检查**

Run: `npm test -- tests/unit/converters-data.test.ts && npm run check`
Expected: PASS，Astro diagnostics 为 0 errors。

- [ ] **Step 5: 提交**

```bash
git add devformat-tools/package.json devformat-tools/astro.config.mjs devformat-tools/tsconfig.json devformat-tools/tailwind.config.mjs devformat-tools/src devformat-tools/tests/unit/converters-data.test.ts
git commit -m "feat: 初始化 DevFormat.tools 静态站点"
```

### Task 2: 公共解析器与错误定位

**Files:**
- Create: `src/lib/converters/utils.ts`
- Test: `tests/unit/converter-utils.test.ts`

**Interfaces:**
- Produces: `ConversionError`, `parseJsonObject(input: string): Record<string, unknown>`, `toPascalCase(value: string): string`。

- [ ] **Step 1: 写空输入、非 object 和语法位置测试**

```ts
expect(() => parseJsonObject('  ')).toThrow('请输入 JSON');
expect(() => parseJsonObject('[1]')).toThrow('根值必须是 JSON object');
try { parseJsonObject('{\n  "a": 1,\n}'); } catch (error) {
  expect(error).toMatchObject({ line: 3, column: expect.any(Number) });
}
```

- [ ] **Step 2: 运行 RED**

Run: `npm test -- tests/unit/converter-utils.test.ts`
Expected: FAIL，原因是模块不存在。

- [ ] **Step 3: 实现稳定错误类型与解析器**

```ts
export class ConversionError extends Error {
  constructor(message: string, public line?: number, public column?: number) {
    super(message);
    this.name = 'ConversionError';
  }
}
export function parseJsonObject(input: string): Record<string, unknown> {
  if (!input.trim()) throw new ConversionError('请输入 JSON');
  // JSON.parse；从 position 计算 line/column；校验非 null、非 array object。
}
```

- [ ] **Step 4: 运行 GREEN**

Run: `npm test -- tests/unit/converter-utils.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add devformat-tools/src/lib/converters/utils.ts devformat-tools/tests/unit/converter-utils.test.ts
git commit -m "feat: 增加 JSON 解析错误边界"
```

### Task 3: 五个转换器与注册表

**Files:**
- Create: `src/lib/converters/jsonToGo.ts`, `jsonToTs.ts`, `jsonToYaml.ts`, `jsonToPython.ts`, `jsonToRust.ts`, `index.ts`
- Test: `tests/unit/converters.test.ts`, `tests/unit/converter-performance.test.ts`

**Interfaces:**
- Consumes: `parseJsonObject()` 与命名工具。
- Produces: `convert(slug: string, input: string): string` 与五个 `(input: string) => string` 纯函数。

- [ ] **Step 1: 为五个格式写基础、嵌套、array、非法和深层输入测试**

```ts
const input = JSON.stringify({ user: { id: 1, active: true }, tags: ['a'] });
expect(jsonToTypeScript(input)).toContain('interface Root');
expect(jsonToGo(input)).toContain('type Root struct');
expect(jsonToYaml(input)).toContain('user:');
expect(jsonToPython(input)).toContain('@dataclass');
expect(jsonToRust(input)).toContain('struct Root');
```

- [ ] **Step 2: 运行算法 RED**

Run: `npm test -- tests/unit/converters.test.ts`
Expected: FAIL，原因是转换模块不存在。

- [ ] **Step 3: 逐个实现最小递归类型推断和确定性输出**

```ts
export type Converter = (input: string) => string;
const converters: Record<string, Converter> = {
  'json-to-go-struct': jsonToGo,
  'json-to-typescript': jsonToTypeScript,
  'json-to-yaml': jsonToYaml,
  'json-to-python-dataclass': jsonToPython,
  'json-to-rust-struct': jsonToRust,
};
export function convert(slug: string, input: string): string {
  const converter = converters[slug];
  if (!converter) throw new ConversionError(`不支持的转换器: ${slug}`);
  return converter(input);
}
```

- [ ] **Step 4: 运行算法 GREEN，再写并观察 1MB 性能测试 RED/GREEN**

Run: `npm test -- tests/unit/converters.test.ts tests/unit/converter-performance.test.ts`
Expected: 所有行为通过，各 converter 多轮中位耗时 <100ms。

- [ ] **Step 5: 提交**

```bash
git add devformat-tools/src/lib/converters devformat-tools/tests/unit/converters.test.ts devformat-tools/tests/unit/converter-performance.test.ts
git commit -m "feat: 实现五类客户端转换器"
```

### Task 4: ConverterTool 交互 island

**Files:**
- Create: `src/components/ConverterTool.tsx`, `src/lib/utils.ts`
- Test: `tests/component/ConverterTool.test.tsx`, `tests/setup.ts`

**Interfaces:**
- Consumes: `convert(slug, input)`、`sampleInput`、`sampleOutput`、`downloadExtension`。
- Produces: Convert、Copy、Clear、Load Example、Download 可访问交互。

- [ ] **Step 1: 写交互失败测试**

```tsx
render(<ConverterTool slug="json-to-typescript" sampleInput='{"id":1}' sampleOutput="sample" downloadExtension="ts" />);
await user.click(screen.getByRole('button', { name: 'Clear' }));
expect(screen.getByLabelText('Input')).toHaveValue('');
await user.click(screen.getByRole('button', { name: 'Load Example' }));
expect(screen.getByLabelText('Input')).toHaveValue('{"id":1}');
```

覆盖非法输入红色错误、Clipboard 的 `Copied!` + 2 秒 timer、Blob 下载和空输出禁用。

- [ ] **Step 2: 运行 RED**

Run: `npm test -- tests/component/ConverterTool.test.tsx`
Expected: FAIL，原因是组件不存在。

- [ ] **Step 3: 实现最小 React 状态机**

```tsx
const [input, setInput] = useState(sampleInput);
const [output, setOutput] = useState(sampleOutput);
const runConversion = (value = input) => {
  try { setOutput(convert(slug, value)); setError(''); }
  catch (cause) { setOutput(''); setError(formatError(cause)); }
};
```

Copy timer 必须在 unmount 时清理；Download 创建、点击并 revoke object URL。

- [ ] **Step 4: 运行 GREEN**

Run: `npm test -- tests/component/ConverterTool.test.tsx`
Expected: PASS，无 act warning。

- [ ] **Step 5: 提交**

```bash
git add devformat-tools/src/components/ConverterTool.tsx devformat-tools/src/lib/utils.ts devformat-tools/tests
git commit -m "feat: 实现转换结果交互"
```

### Task 5: Astro 页面、Layout 与 SEO 端点

**Files:**
- Create: `src/styles/global.css`, `src/components/Header.astro`, `Footer.astro`, `FAQSection.astro`
- Create: `src/layouts/Layout.astro`, `src/pages/index.astro`, `src/pages/convert/[slug].astro`, `src/pages/robots.txt.ts`, `public/favicon.svg`
- Test: `tests/unit/seo-contract.test.ts`

**Interfaces:**
- Consumes: `ConverterData[]` 和 `ConverterTool`。
- Produces: `/`、5 个 `/convert/<slug>/`、`/robots.txt`。

- [ ] **Step 1: 写源级 SEO/路由契约测试**

```ts
expect(layoutSource).toContain('rel="canonical"');
expect(layoutSource).toContain('application/ld+json');
expect(routeSource).toContain('getStaticPaths');
expect(robots.GET().body).toContain('Sitemap: https://devformat.tools/sitemap-index.xml');
```

- [ ] **Step 2: 运行 RED**

Run: `npm test -- tests/unit/seo-contract.test.ts`
Expected: FAIL，原因是页面和端点不存在。

- [ ] **Step 3: 实现静态页面和语义化组件**

```astro
export function getStaticPaths() {
  return converters.map((converter) => ({ params: { slug: converter.slug }, props: { converter } }));
}
<Layout title={converter.title} description={converter.description} canonical={`/convert/${converter.slug}/`}>
  <ConverterTool client:load {...props} />
  <FAQSection items={converter.faq} />
</Layout>
```

Layout 输出 JSON-LD 与 OpenGraph；全局样式使用本地/system fonts，响应式双栏输入输出。

- [ ] **Step 4: 运行 GREEN 与 Astro check**

Run: `npm test -- tests/unit/seo-contract.test.ts && npm run check`
Expected: PASS，0 errors。

- [ ] **Step 5: 提交**

```bash
git add devformat-tools/src/components devformat-tools/src/layouts devformat-tools/src/pages devformat-tools/src/styles devformat-tools/public devformat-tools/tests/unit/seo-contract.test.ts
git commit -m "feat: 生成 pSEO 转换页面"
```

### Task 6: 构建产物验收与交付审计

**Files:**
- Create: `tests/build/dist.test.ts`, `docs/verification/PRD-0.0.1.md`, `lighthouserc.json`
- Modify: `README.md`, `../openspec/changes/build-devformat-tools/tasks.md`

**Interfaces:**
- Consumes: `dist/` 与 PRD/OpenSpec requirements。
- Produces: 可重复构建验收、部署 LCP 命令和逐项证据矩阵。

- [ ] **Step 1: 在构建前写 dist 失败测试并观察 RED**

```ts
for (const { slug } of converters) {
  expect(existsSync(`dist/convert/${slug}/index.html`)).toBe(true);
  expect(sitemap).toContain(`/convert/${slug}/`);
}
expect(readFileSync('dist/robots.txt', 'utf8')).toContain('https://devformat.tools/sitemap-index.xml');
```

Run: `npm run verify:build`
Expected: FAIL，原因是尚无 `dist/`。

- [ ] **Step 2: 构建并运行 GREEN**

Run: `npm run build && npm run verify:build`
Expected: 5 个页面、全部 slug、robots、sitemap、canonical/OpenGraph/JSON-LD 全部 PASS。

- [ ] **Step 3: 执行完整质量门禁**

Run: `npm test && npm run check && npm run build && npm run verify:build && npm audit --omit=dev`
Expected: 全部 exit 0；若 audit 只有 dev-only 风险，在验收报告中精确记录，不隐藏。

- [ ] **Step 4: 记录验收证据并勾选 OpenSpec tasks**

`docs/verification/PRD-0.0.1.md` 必须逐条映射 US-001 到 US-004；LCP 标记为“需预览部署实测”，并给出：

```bash
npx lhci autorun --collect.url=https://preview.devformat.tools/convert/json-to-typescript/
```

- [ ] **Step 5: 最终提交**

```bash
git add devformat-tools openspec/changes/build-devformat-tools
git commit -m "test: 完成 DevFormat.tools 交付验收"
```
