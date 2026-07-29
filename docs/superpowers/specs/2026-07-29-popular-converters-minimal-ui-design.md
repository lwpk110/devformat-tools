# 高频转换工具与极简界面设计

> 交互更新：本文的 canonical 与数据模型决策仍然有效；Swap 交互已由 [固定双输入转换器设计](./2026-07-29-fixed-dual-input-converter-design.md) 取代。

日期：2026-07-29

## 背景与目标

DevFormat.tools 当前首页平铺五个 JSON 单向工具，无法反映用户最常搜索的转换意图。此次变更以 Google SEO 调研排序首页入口，新增五组高频工具，并把可逆方向合并到一个 canonical 页面。界面保持快速、本地、打开即用。

## 方案比较

### 方案 A：一个 canonical 页面，Swap 切换方向（采用）

每个互转组只有一个 slug。页面数据包含多个 directions，Swap 在客户端切换 direction、示例与下载扩展名。优点是 SEO 权重集中、无重复内容、体验连贯；代价是页面元数据和正文必须同时覆盖两个方向。

### 方案 B：两个页面，互相链接

每个方向独立匹配精确关键词，但内容和功能高度重复，容易发生 canonical 冲突和关键词内耗，也违反用户明确约束，因此不采用。

### 方案 C：同页使用 query 参数表示方向

可以分享当前方向，但爬虫可能发现参数 URL，需额外处理 canonical 与参数收录。MVP 没有分享方向状态的必要，因此不采用。

## 信息架构

首页由三部分组成：简洁 Hero、`Popular conversions`、`All tools`。Popular 按调研优先级展示 JSON ↔ CSV、Base64 Encode ↔ Decode、JSON ↔ YAML、JSON ↔ XML、Unix Timestamp ↔ DateTime。All tools 按类别链接 Top 5 和现有 JSON 类型生成器，保证专业长尾能力仍在一次点击内。

最终 canonical 工具页共九个：五个双向高频页，加 JSON → TypeScript、Go Struct、Python Dataclass、Rust Struct 四个单向页。旧 `/convert/json-to-yaml/` 在托管层配置为永久重定向至 `/convert/json-yaml/`，不生成第二份工具 HTML。

## 数据模型

```ts
interface ConverterDirection {
  id: string;
  from: string;
  to: string;
  sampleInput: string;
  sampleOutput: string;
  downloadExtension: string;
  summary: string;
}

interface ConverterData {
  slug: string;
  category: string;
  title: string;
  description: string;
  featuredRank?: number;
  directions: ConverterDirection[];
  faq: FAQItem[];
}
```

所有工具统一使用 `directions`。单向生成器只有一个 direction，因此不显示 Swap；双向工具恰好有两个 direction。转换 registry 使用 direction ID，而不是页面 slug，避免页面路由与算法方向耦合。

## 转换边界

- JSON ↔ CSV：支持 object 或 object array；CSV 支持 header、逗号、双引号和换行转义；嵌套 JSON 值序列化为 JSON 字符串。
- Base64：使用 UTF-8 文本编码与标准 Base64，不处理文件上传和 data URL。
- JSON ↔ YAML：使用 `yaml` 包解析和序列化，支持常规嵌套对象与数组。
- JSON ↔ XML：根节点固定为 `root`；attribute 使用 `@`，文本使用 `#text`，重复元素映射为数组；拒绝 `DOCTYPE` 和 `ENTITY`。
- Unix Timestamp ↔ DateTime：数字长度自动识别 seconds 或 milliseconds，输出 UTC ISO 8601；DateTime 反向输出 Unix seconds。

非法输入统一抛出 `ConversionError`，显示可操作的中文错误，不清除用户输入。失败时清空陈旧输出。

## 工具页交互

格式名称与 Swap 位于编辑器上方。点击 Swap 后，当前输出成为新输入；如果输出为空，则加载新方向示例。Convert 明确触发转换。辅助操作包括 Load Example、Clear、Copy 和 Download。所有转换只在浏览器内执行。

桌面端输入输出并排，移动端上下堆叠。按钮、textarea 和状态提示具有可见 focus、明确 label 和足够触控面积。React island 使用 `client:idle`，静态标题与 SEO 正文不依赖 hydration。

## 视觉方向

采用“quiet utility”极简工具风：暖白背景、近黑正文、低饱和蓝绿色作为唯一强调色，细边框与轻微阴影建立层级。去除厚重 neo-brutalist 边框、大面积荧光色和装饰性文案。字体使用系统 sans，代码区使用系统 mono。首页首屏强调工具入口，不用插画、渐变或动画。

## SEO

每页输出唯一 canonical、SoftwareApplication JSON-LD、OpenGraph 元数据和可抓取正文。双向页的 title、description、H1、FAQ 同时自然包含两个方向。首页和 Related tools 使用服务端渲染的普通链接。sitemap 只列九个 canonical 工具页，不列旧方向 URL。

## 测试与验收

- 单元测试覆盖五组新增算法的正常、边界和非法输入。
- 数据测试确保 featuredRank 唯一且按 1–5 连续排列；双向页只有一个 slug 和两个 directions。
- 组件测试覆盖 Swap、输出回填、示例、错误、复制、下载和单向页不显示 Swap。
- 构建测试验证九个 canonical 页面、首页 Popular/All tools、sitemap 和旧 URL 不生成 HTML。
- 运行 `npm test`、`npm run check`、`npm run build`、`npm run verify:build`。
- 用桌面和移动视口检查首页与工具页；移动 Lighthouse 的 LCP 目标不超过 1.2 秒。

## 非目标

本轮不实现文件上传、JSON ↔ Excel、URL 编解码、JWT、颜色工具、云端存储、账户系统、转换历史或 query 参数方向分享。

## 决策确认

用户明确要求互转不使用两个页面。本设计将其落实为唯一 canonical 页面和客户端 Swap，所有验收以此为硬约束。
