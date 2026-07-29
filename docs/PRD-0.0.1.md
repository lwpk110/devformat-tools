这份 PRD 是专为 Codex / Claude Code 等 AI 编程 Agent 深度优化的**产品需求文档 (PRD)**。格式符合标准工程规范，包含明确的接口定义、文件树架构、用户故事以及可自动化执行的测试与部署指令。

你可以直接将以下内容保存为项目根目录下的 `PRD.md` 并交由 Codex 执行。

---

# Product Requirements Document (PRD)

## Project Name: DevFormat.tools

**Document Version:** 1.0.0

**Target Environment:** Node.js >= 18.x, Astro v4.x, Cloudflare Pages

**Core Objective:** 零服务器成本、极致性能的程序化 SEO (pSEO) 开发者转换工具箱。

---

## 1. 系统架构与技术选型 (System Architecture)

* **前端/SSG 框架**: Astro (SSG 模式，全静态预渲染)
* **样式库**: Tailwind CSS
* **核心转换引擎**: 纯客户端 TypeScript 模块（零后端 API 依赖，数据不出浏览器）
* **SEO & 站点地图**: `@astrojs/sitemap` + 动态 `robots.txt.ts` 端点
* **部署平台**: Cloudflare Pages / Vercel (纯静态文件托管)

---

## 2. 数据结构规范 (Data Schema)

所有 pSEO 页面路由由 `src/data/converters.json` 驱动。Codex 必须遵循以下 TypeScript 接口类型定义：

```typescript
// src/types/converter.ts

export interface FAQItem {
  q: string;
  a: string;
}

export interface ConverterData {
  slug: string;             // 示例: "json-to-go-struct"
  from: string;             // 源格式名称，示例: "JSON"
  to: string;               // 目标格式名称，示例: "Go Struct"
  category: string;         // 分类，示例: "Type Generators"
  title: string;            // SEO 标题
  description: string;      // SEO Meta 描述
  sampleInput: string;      // 默认输入的示例代码
  sampleOutput: string;     // 默认输出的预设代码
  faq: FAQItem[];           // 长尾 FAQ 列表
}

```

---

## 3. 用户故事与验收标准 (User Stories & Acceptance Criteria)

### US-001: 程序化路由与静态生成 (pSEO Routing)

* **As a** 搜索引擎爬虫 / 开发者
* **I want to** 通过独立的长尾 URL（如 `/convert/json-to-go-struct`）直接访问特定转换工具
* **So that** 页面能被搜索引擎高效收录，且用户打开即用。
* **Acceptance Criteria**:
1. 系统必须读取 `src/data/converters.json`，通过 `getStaticPaths()` 为每个 `slug` 编译生成独立的静态 `index.html`。
2. 页面首屏加载性能 Core Web Vitals 的 LCP (Largest Contentful Paint) 不得超过 1.2 秒。
3. 页面必须注入标准 `SoftwareApplication` 格式的 Schema.org JSON-LD。
4. 页面 Head 中必须包含标准的 Canonical URL 标签与 OpenGraph 社交卡片标签。



### US-002: 纯前端转换引擎 (Client-side Conversion Engine)

* **As a** 开发者
* **I want to** 在左侧输入框粘贴源代码（如 JSON），右侧实时或点击后生成目标格式（如 Go Struct）
* **So that** 我可以快速获取所需代码，且无需担心敏感代码泄露给第三方服务器。
* **Acceptance Criteria**:
1. 所有转换逻辑必须在客户端运行（不产生任何 HTTP POST 到后端 API 的请求）。
2. 当输入格式非法时，右侧输出框需以友好红字提示语法错误位置，不得引发页面崩溃。
3. 转换逻辑响应时间必须 < 100ms（在 1MB 输入规模下）。



### US-003: 转换结果操作体验 (UX & Interactivity)

* **As a** 开发者
* **I want to** 一键复制转换后的结果或下载为文件
* **So that** 我能无缝切换回 IDE 粘贴使用。
* **Acceptance Criteria**:
1. 提供 "Copy to Clipboard" 按钮，点击后提示 "Copied!" 状态并在 2 秒后恢复。
2. 提供 "Clear" 按钮一键清空输入输出。
3. 页面提供示例加载按钮（"Load Example"），填充 JSON 中的 `sampleInput`。



### US-004: SEO 基础建设全自动化 (Sitemap & Robots.txt)

* **As a** 搜索引擎爬虫
* **I want to** 访问 `/robots.txt` 和 `/sitemap-index.xml`
* **So that** 我能自动感知站点所有的转换工具页面。
* **Acceptance Criteria**:
1. 运行 `npm run build` 时，必须自动在 `dist/` 根目录生成合法有效且包含所有 `slug` 路径的 `sitemap-0.xml`。
2. `/robots.txt` 必须包含指向站点地图索引文件的完整路径 `Sitemap: https://<domain>/sitemap-index.xml`。



---

## 4. 推荐目录树架构 (Target File Directory)

Codex 在生成代码时，需严格遵循以下目录架构进行组织：

```text
.
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/
│   └── favicon.svg
└── src/
    ├── components/
    │   ├── Header.astro
    │   ├── Footer.astro
    │   ├── ConverterTool.tsx     # 核心交互组件 (React/Vue 或 Vanilla JS)
    │   └── FAQSection.astro
    ├── data/
    │   └── converters.json       # 存放转换词对矩阵
    ├── layouts/
    │   └── Layout.astro          # 全局页面 Layout (含 Meta, Schema, CSS)
    ├── lib/
    │   ├── converters/           # 各具体转换算法模块
    │   │   ├── jsonToGo.ts
    │   │   ├── jsonToTs.ts
    │   │   └── index.ts
    │   └── utils.ts
    ├── pages/
    │   ├── index.astro           # 首页 (工具列表聚合页)
    │   ├── robots.txt.ts         # 动态生成 robots.txt
    │   └── convert/
    │       └── [slug].astro      # pSEO 动态路由核心页面
    └── types/
        └── converter.ts

```

---

## 5. 测试与质量验证计划 (Testing Plan)

### 5.1 单元测试 (Unit Testing)

* **工具**: Vitest
* **覆盖范围**: `src/lib/converters/` 内的所有转换函数。
* **测试用例要求**:
* 测试基础正常数据输入与预期输出对比。
* 测试边界条件（空输入、极深嵌套对象、非法语法字符串）。



### 5.2 构建与 SEO 校验 (Build Verification)

* **命令**: `npm run build`
* **验证点**:
* 检查 `dist/convert/` 目录下生成的 HTML 数量是否与 `converters.json` 数组长度一致。
* 检查 `dist/sitemap-0.xml` 内是否覆盖所有生成的 URL。



---

## 6. Codex 步骤化开发执行指令 (Execution Prompt Sequence for Codex)

你可以按顺序复制以下指令交给 Codex 分步完成：

### 阶段 1：项目脚手架与配置初始化

> "请根据 PRD 需求，创建一个新的 Astro 项目，安装 `@astrojs/sitemap` 和 `tailwindcss`。配置 `astro.config.mjs`，确保将 site 域名设为 `[https://devformat.tools](https://devformat.tools)`，配置 sitemap 插件，并建立 `src/types/converter.ts` 接口文件。"

### 阶段 2：转换算法与数据源注入

> "请在 `src/data/converters.json` 中填充 5 个示例词对（包括 json-to-go-struct, json-to-typescript, json-to-yaml 等）。然后在 `src/lib/converters/` 下编写纯 TS 转换函数，实现 JSON 转 Go Struct 和 TS Interface 的转换逻辑，并配置 Vitest 进行单元测试。"

### 阶段 3：pSEO 核心页面与组件实现

> "请编写 `src/layouts/Layout.astro` 与 `src/pages/convert/[slug].astro`。实现 `getStaticPaths()` 读取 `converters.json` 动态生成页面，注入完整的 SEO Meta 标签、Schema.org JSON-LD 结构化数据，以及渲染转换器交互界面与 FAQ 文本区域。"

### 阶段 4：自动化 SEO 端点与测试构建

> "请创建 `src/pages/robots.txt.ts` 端点。运行 `npm run build` 和 `npm run test`，确保静态编译无报错，检查 `dist/` 目录下是否包含所有的 HTML 页面以及 sitemap-index.xml / robots.txt。"
