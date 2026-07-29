# DevFormat.tools 设计说明

## 目标与边界

DevFormat.tools 是一个部署到 Cloudflare Pages 或 Vercel 的全静态开发者转换工具站。Astro 在构建期为每个转换器生成独立页面；用户输入仅在浏览器内处理，不依赖后端 API。首版提供 5 个由 JSON 驱动的转换页面，并将 SEO 元数据、FAQ、站点地图和 `robots.txt` 一并静态产出。

首版不包含账号、服务端存储、遥测上报、在线协作或任意代码执行。转换引擎只接受 JSON 文本，并输出代码或 YAML 文本。

## 方案比较与结论

1. **React island**：使用 `ConverterTool.tsx` 并通过 `client:load` 激活。优点是严格匹配 PRD 的目标文件结构、交互状态清晰且测试生态成熟；代价是增加少量 React runtime。
2. **Astro + Vanilla TypeScript**：运行时代码最小，LCP 最有优势；但会偏离 PRD 明确列出的 `ConverterTool.tsx`，复杂交互测试也更分散。
3. **整页 SPA**：开发直接，但破坏静态 HTML 优先和最低 JavaScript 成本，不适合 pSEO。

采用方案 1。页面标题、说明、FAQ 和样例输出均由 Astro 服务器端渲染，只有转换器交互区域通过 `client:idle` hydration。这样既保留独立静态页面和可索引正文，又把 React 成本限制在单个 island，并避免 hydration 与 LCP 竞争主线程。

## 技术栈与版本

- Node.js >= 18，开发与 CI 使用 Node.js 20。
- Astro 4.x，`output: "static"`，站点地址为 `https://devformat.tools`。
- React 18 + `@astrojs/react`，只承载转换器 island。
- Tailwind CSS 3 + `@astrojs/tailwind`。
- `@astrojs/sitemap` 生成 `sitemap-index.xml` 和 `sitemap-0.xml`。
- Vitest 负责转换器、数据契约和构建产物测试。

## 系统结构

`src/data/converters.json` 是页面矩阵的唯一事实来源。每项遵循 `ConverterData`，首版 slug 为：

- `json-to-go-struct`
- `json-to-typescript`
- `json-to-yaml`
- `json-to-python-dataclass`
- `json-to-rust-struct`

`src/pages/convert/[slug].astro` 使用 `getStaticPaths()` 将数据映射为构建路径，并把单项数据传入 Layout、ConverterTool 和 FAQSection。`Layout.astro` 统一生成 canonical、OpenGraph 和 `SoftwareApplication` JSON-LD。首页按分类展示全部工具链接。

`src/lib/converters/` 中每个目标格式拥有独立模块。公共解析、标识符清洗、类型合并和错误定位放在 `utils.ts`；`index.ts` 只维护 slug 到纯函数的显式注册表。所有函数签名统一为 `(input: string) => string`，不读取 DOM、不发网络请求，便于在浏览器和 Vitest 中执行。

## 转换规则

- 根输入必须是 JSON object；空输入、非法 JSON 和非 object 根值返回 `ConversionError`。
- 对象键转换为目标语言的合法字段名；无法直接使用的原始键通过该语言的 rename/映射语法保留语义。
- nested object 生成命名类型；array 根据元素推断类型，空 array 使用目标语言安全的 unknown/any 表达。
- 同一 array 内存在不同类型时使用目标语言可表达的联合或通用类型，不静默丢弃值域。
- JSON → YAML 保持字段顺序，字符串按需引用，不引入网络或动态执行。
- 所有输出确定性生成，相同输入必定得到相同文本。

## 客户端交互与数据流

ConverterTool 初始展示 `sampleInput` 和 `sampleOutput`，避免 hydration 前后的空白跳变。点击 Convert 时调用注册表中的纯函数；成功则更新只读输出，失败则显示红色、带行列信息的友好错误。输入变化不会自动执行昂贵转换，确保大文本粘贴流畅。

Copy 使用 Clipboard API，成功后按钮文字变为 `Copied!`，2 秒后恢复；失败时显示可见错误。Clear 同时清空输入、输出和错误。Load Example 恢复当前页面的 `sampleInput` 并立即转换。Download 将结果包装成 Blob，以目标格式扩展名下载；这补足 PRD 用户故事中“复制或下载”的明确意图。

组件不包含 `fetch`、XHR 或表单 POST。Content Security Policy 由部署平台决定，应用自身不需要任何 API origin。

## SEO 与静态输出

每个转换页包含唯一 title、description、canonical、`og:title`、`og:description`、`og:type`、`og:url`。JSON-LD 类型为 `SoftwareApplication`，包含名称、描述、URL、应用类别、操作系统和免费价格信息。FAQ 使用原生标题和 `details`，保证无 JavaScript 时仍可阅读。

`robots.txt.ts` 在静态构建时输出：允许全站抓取，并指向 `https://devformat.tools/sitemap-index.xml`。构建验收脚本核对转换 HTML 数量与 JSON 条目数相同，并检查两个 sitemap 文件及所有 slug。

## 性能设计

- 页面正文 SSG，字体使用系统 font stack，不加载远程字体和首屏图片。
- 仅 ConverterTool 使用 `client:idle`；其余组件零客户端 JavaScript。
- 转换操作在点击后同步执行并计时；1MB 基准输入在 Node.js 20 的中位耗时必须小于 100ms。
- LCP 1.2 秒属于真实部署环境指标，仓库提供静态性能预算和 Lighthouse 配置；最终数值需在 Cloudflare Pages 部署后由 Lighthouse 验证，不能由本地单元测试伪造。

## 错误处理

`ConversionError` 统一携带用户可读 message、line 和 column。JSON parser 原生错误若只有 byte position，则工具根据输入计算行列。ConverterTool 捕获预期错误并展示，不让异常越过事件边界；未知异常转为通用提示并保留浏览器控制台诊断。

Clipboard、Blob URL 等浏览器能力失败时只影响对应操作，不清除已有输入和转换结果。

## 测试与验收

按 TDD 实现，测试先于生产代码并实际观察 RED：

- 每个转换模块：基础对象、nested object、array、空输入、非法 JSON、深层对象。
- 注册表：5 个 slug 均有实现，未知 slug 返回明确错误。
- React 组件：Convert、错误显示、Copy 的 2 秒状态、Clear、Load Example、Download。
- 数据契约：5 个条目字段完整、slug 唯一、FAQ 非空。
- 构建验收：5 个静态 HTML、canonical/OpenGraph/JSON-LD、`robots.txt`、sitemap 覆盖全部 slug。
- 性能基准：1MB JSON 输入的转换中位耗时 < 100ms；若共享 CI 抖动明显，报告实测而不放宽产品阈值。

完成标准为 `npm test`、`npm run check`、`npm run build`、构建验收和 `npm audit --omit=dev` 均无阻断问题，并逐条核对 PRD 验收条件。

## 自审结论

文档无未决占位符；5 个页面、所有交互、SEO 产物、错误边界和性能阈值均有明确责任模块与验证方式。首版范围保持单一：只做 JSON 源格式的静态转换工具站，不引入未要求的后台能力。
