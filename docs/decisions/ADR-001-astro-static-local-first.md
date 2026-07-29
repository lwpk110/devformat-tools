# ADR-001：采用 Astro SSG 与单一 React island

## 状态

Accepted

## 日期

2026-07-28

## 背景

DevFormat.tools 需要为每个转换词对提供可索引的独立 URL，同时保证输入不离开浏览器、首屏 LCP 不超过 1.2 秒、部署无需服务器成本。PRD 指定 Astro 4、Tailwind CSS 和 `ConverterTool.tsx` 目录契约。

## 决策

使用 Astro 4 的 `output: "static"` 生成页面、FAQ、SEO 元数据、robots 和 sitemap。页面只有 `ConverterTool.tsx` 通过 `client:idle` hydration；转换算法是无 DOM/网络依赖的纯 TypeScript 函数。移动端 Lighthouse 证明 `client:load` 会让 hydration 与首屏绘制竞争，因此选择 idle 激活。

所有框架与构建工具列为 `devDependencies`。部署只发布 `dist/`，不在生产环境运行 Astro server、Vite dev server 或 Node.js 应用。

## 备选方案

### Astro + Vanilla TypeScript

- 优点：客户端 bundle 最小。
- 缺点：偏离 PRD 指定的 `ConverterTool.tsx`，交互状态与组件测试更分散。
- 结论：首版不采用；若真实部署 LCP 无法达标，可通过 superseding ADR 迁移。

### 整页 React SPA

- 优点：开发模型统一。
- 缺点：可索引正文依赖 hydration，客户端开销更大，不符合 pSEO 和极致性能目标。
- 结论：拒绝。

### 服务端转换 API

- 优点：可隐藏算法、集中升级。
- 缺点：增加成本、延迟和用户数据外传，与核心隐私承诺冲突。
- 结论：拒绝。

## 后果

- 每个 converter 在构建期拥有完整 HTML，禁用 JavaScript 时 SEO 正文与 FAQ 仍可读取。
- React runtime 只服务一个交互 island；当前 gzip client runtime 约 44KB，需持续由 Lighthouse 监控。
- 新 converter 必须同时增加测试、注册表实现和 JSON 数据项。
- Astro 4 已停止获得当前安全修复，但它只参与可信源码的本地/CI 构建。完整 build tool audit 风险必须保留记录；升级 major 需要单独 ADR 与兼容验证。
