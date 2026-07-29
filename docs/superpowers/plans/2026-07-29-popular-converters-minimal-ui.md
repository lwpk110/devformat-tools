# 高频转换工具与极简界面实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 Google 搜索需求突出五组高频工具，并让每组互转在一个极简 canonical 页面中通过 Swap 完成。

**Architecture:** Astro 从页面级 converter 数据生成九个静态 canonical 页面；每页把一个或两个 directions 传入 React island。转换 registry 按 direction ID 调用小型本地算法模块，静态 SEO 内容与交互逻辑解耦。

**Tech Stack:** Astro 4、React 18、TypeScript 5、Tailwind CSS、Vitest、Testing Library、yaml

## Global Constraints

- 每组互转只生成一个 canonical 页面，Swap 不改变 URL。
- 所有转换只在浏览器执行，禁止上传用户数据。
- Top 5 顺序固定为 JSON ↔ CSV、Base64、JSON ↔ YAML、JSON ↔ XML、Unix Timestamp ↔ DateTime。
- 最终只生成九个工具页；旧 `/convert/json-to-yaml/` 仅永久重定向。
- 新功能严格执行 RED → GREEN → REFACTOR。

---

### Task 1: 迁移数据模型

**Files:**
- Modify: `src/types/converter.ts`
- Modify: `src/data/converters.json`
- Test: `tests/unit/converters-data.test.ts`

**Interfaces:**
- Produces: `ConverterDirection` 和含 `directions`、`featuredRank?` 的 `ConverterData`

- [ ] **Step 1: 写失败测试**：断言共有九个 slug、featuredRank 为 1–5、Top 5 各有两个 direction、四个生成器各有一个 direction。
- [ ] **Step 2: 运行 RED**：`npm test -- tests/unit/converters-data.test.ts`，预期旧数据缺少 `directions`。
- [ ] **Step 3: 最小实现**：更新类型和 JSON 数据，移除顶层 `from/to/sampleInput/sampleOutput`。
- [ ] **Step 4: 运行 GREEN**：同一命令预期通过。

### Task 2: 实现五组转换算法

**Files:**
- Create: `src/lib/converters/csv.ts`
- Create: `src/lib/converters/base64.ts`
- Create: `src/lib/converters/yaml.ts`
- Create: `src/lib/converters/xml.ts`
- Create: `src/lib/converters/timestamp.ts`
- Modify: `src/lib/converters/index.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/unit/converters.test.ts`

**Interfaces:**
- Produces: `convert(directionId: string, input: string): string`
- Error contract: 非法输入抛出 `ConversionError`

- [ ] **Step 1: 写失败测试**：覆盖 CSV 引号/换行、UTF-8 Base64、YAML 嵌套、XML attribute/array/危险声明、Timestamp seconds/milliseconds 与 DateTime 反向。
- [ ] **Step 2: 运行 RED**：`npm test -- tests/unit/converters.test.ts`，预期新增 direction 未注册。
- [ ] **Step 3: 安装依赖**：`npm install yaml`。
- [ ] **Step 4: 最小实现**：实现五个聚焦模块并在 registry 注册十个 direction ID。
- [ ] **Step 5: 运行 GREEN**：同一测试命令预期全部通过。

### Task 3: 实现单页双向交互

**Files:**
- Modify: `src/components/ConverterTool.tsx`
- Test: `tests/component/ConverterTool.test.tsx`

**Interfaces:**
- Consumes: `directions: ConverterDirection[]`
- Produces: Swap、Convert、Load Example、Clear、Copy、Download UI

- [ ] **Step 1: 写失败测试**：断言双向页显示 Swap；有输出时 Swap 回填输出；空输出时加载反向示例；单 direction 不显示 Swap。
- [ ] **Step 2: 运行 RED**：`npm test -- tests/component/ConverterTool.test.tsx`，预期 props 与 Swap 行为不存在。
- [ ] **Step 3: 最小实现**：用 direction index 驱动标签、算法、示例和下载扩展名，保留现有错误与剪贴板行为。
- [ ] **Step 4: 运行 GREEN**：同一测试命令预期通过。

### Task 4: 重构首页发现结构

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Test: `tests/unit/seo-contract.test.ts`

**Interfaces:**
- Consumes: `featuredRank` 与 converter category
- Produces: 静态 `Popular conversions`、`All tools` 链接

- [ ] **Step 1: 写失败测试**：读取首页源码并断言 Popular 在 All tools 前，排序来自 featuredRank，所有工具使用 canonical 链接。
- [ ] **Step 2: 运行 RED**：`npm test -- tests/unit/seo-contract.test.ts`，预期旧首页结构失败。
- [ ] **Step 3: 最小实现**：实现 quiet utility Hero、五张 Popular 卡和分类 All tools。
- [ ] **Step 4: 运行 GREEN**：同一测试命令预期通过。

### Task 5: 重构 canonical 工具页

**Files:**
- Modify: `src/pages/convert/[slug].astro`
- Modify: `src/components/FAQSection.astro`
- Modify: `src/layouts/Layout.astro`
- Create: `public/_redirects`
- Test: `tests/build/dist.test.ts`

**Interfaces:**
- Consumes: `ConverterData.directions`
- Produces: 九个页面、双向静态说明、Related tools、旧 URL redirect

- [ ] **Step 1: 写失败构建测试**：断言九个页面存在、旧路径不存在、每页唯一 canonical、双方向文案存在、sitemap 无旧 URL。
- [ ] **Step 2: 运行 RED**：`npm run build && npm run verify:build`，预期旧构建页面集失败。
- [ ] **Step 3: 最小实现**：移除 extension map，把 directions 传给 island，并添加静态 direction sections、FAQ、Related tools 和 redirect。
- [ ] **Step 4: 运行 GREEN**：重复构建验证，预期通过。

### Task 6: 完整质量与视觉验收

**Files:**
- Modify: `docs/verification/openspec-build-devformat-tools.md`
- Modify: `openspec/changes/prioritize-popular-converters/tasks.md`

- [ ] **Step 1: 完整测试**：依次运行 `npm test`、`npm run check`、`npm run build`、`npm run verify:build`，全部预期 exit 0。
- [ ] **Step 2: 运行本地预览**：`npm run dev -- --host 0.0.0.0`，检查首页、JSON ↔ CSV 与 JSON ↔ YAML。
- [ ] **Step 3: 视觉检查**：在 1440×900 和 390×844 截图，确认无水平滚动、Swap 和主要动作在首屏可见。
- [ ] **Step 4: 性能检查**：运行移动 Lighthouse，LCP 目标 ≤ 1200ms；若环境噪声导致失败，记录实测值和环境。
- [ ] **Step 5: 安全检查**：确认无网络上传路径、XML 拒绝 DTD/ENTITY、依赖审计无高危生产漏洞。
- [ ] **Step 6: 更新 OpenSpec**：勾选任务、执行 validate/verify，并在所有证据通过后归档变更。
