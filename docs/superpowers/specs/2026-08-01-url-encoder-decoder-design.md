# URL Encoder / Decoder 工具设计

## 背景

开发者经常需要把文本安全地放入 URL 的 path、query value 或 fragment 中，也需要检查现有百分号编码的真实文本。DevFormat.tools 已有统一的双向转换器数据、静态路由和浏览器内本地处理能力，适合将这一能力作为标准转换器接入。

## 目标

新增一个 canonical URL Encoder / Decoder 工具，页面为 `/convert/url-encode/`，提供固定方向的 Text 到 URL encoded 与 URL encoded 到 Text 转换。处理全程留在浏览器内，不新增网络、存储或第三方依赖。

## 范围

- 新增 `url-encode` 与 `url-decode` 两个转换 direction。
- 新增 `url-encode` converter metadata，进入 `Encoding` 分类与 All tools。
- 复用 `ConverterTool` 的双输入、复制和下载操作，不创建新的 UI 组件或路由类型。
- 为转换行为、数据契约、工具目录、构建产物和性能基线补充或更新自动化测试。

本次不新增完整 URL parser、参数表单、批量处理、`application/x-www-form-urlencoded` 模式或 Popular tools 排名。

## URL 语义

使用 ECMAScript 标准库的 `encodeURIComponent` 与 `decodeURIComponent`：

- 编码按 URL component 语义处理，空格输出 `%20`，Unicode 以 UTF-8 百分号编码。
- `+` 是普通字面字符，编码为 `%2B`；解码输入中的 `+` 仍为 `+`，不会变为空格。
- 解码时由 `decodeURIComponent` 识别合法百分号转义；如 `%ZZ`、孤立 `%` 或无效 UTF-8，转换器捕获 `URIError` 并抛出项目统一的 `ConversionError`。

这与 `URLSearchParams` 和 HTML form 的 `+` 空格约定不同。后者只适用于 `application/x-www-form-urlencoded`，如果后续需要，应以明确模式选择单独交付，避免一个输入产生两种含义。

## 架构与数据流

新增 `src/lib/converters/url.ts`，其中导出两个纯函数。它们仅接收和返回字符串，错误使用 `ConversionError` 表达，因此不依赖 DOM、React 或网络。

在 `src/lib/converters/index.ts` 注册两个 direction id，使 `convert(direction.id, input)` 可从现有组件调用。`src/data/converters.json` 新增一个 `url-encode` 条目，含标题、描述、两个方向的样例、FAQ 与 SEO 内容。现有 `src/pages/convert/[slug].astro` 会据此生成页面和 sitemap；`src/data/toolCatalog.ts` 会从该数据生成 Encoding 分类的目录项，无需额外注册。

新条目不设置 `featuredRank`，因此不会改变首页 Popular tools 的排序。All tools 中的分类内排序继续由现有目录逻辑处理。

## 交互与错误处理

页面继续显示两个固定格式编辑器和方向按钮。用户从 Text 编辑器执行编码时更新 URL encoded 编辑器；反向执行时更新 Text 编辑器。转换失败时，目标编辑器清空并显示现有 `ConverterTool` 的错误提示；错误信息应明确说明 URL 编码无效，而不是暴露原生 `URIError`。

复制与下载继续针对最近一次方向的输出，文件名和 `.txt` 扩展名沿用现有组件规则。

## 测试与验收

- 单元测试断言空格、保留字符、CJK、emoji 与字面 `+` 的 URL component 编码和往返结果。
- 单元测试断言非法百分号转义抛出 `ConversionError`。
- 示例契约测试验证 metadata 样例能被已注册方向精确转换。
- 数据契约测试将转换器总数更新为 10，并保留已发布方向与特色排序的断言。
- 工具目录测试将总数更新为 11，验证 URL Encoder / Decoder 位于 Encoding 分类，且 Popular tools 不包含它。
- 运行 `npm test`、`npm run check`、`npm run build` 与 `npm run verify:build`；性能测试的覆盖范围随 direction 列表自动扩展时，一并验证。

## 备选方案

### 采用 form 编码

该方案将空格编码为 `+`，并把解码输入中的 `+` 还原为空格。它适合 HTML 表单提交，但会破坏普通 URL component 中真实加号的往返，且需要明确的模式控制，故不纳入本次。

### 新建独立 URL 工具组件

独立组件可以支持 URL 分段解析，但会重复现有双向工作区与目录接入，且超出纯编码需求。本次复用 `ConverterTool`，保留未来新增 URL parser 的独立空间。

## 验收标准

1. `/convert/url-encode/` 提供 Text 到 URL encoded 和 URL encoded 到 Text 两个固定方向。
2. 行为符合 `encodeURIComponent` / `decodeURIComponent`，Unicode 和保留字符可逆。
3. 无效百分号编码显示可读错误，且内部使用 `ConversionError`。
4. `+` 按字面加号处理，不使用表单编码语义。
5. 工具出现在 Encoding 的 All tools，不影响现有 Popular tools 顺序。
6. 全部本地测试、类型检查、构建及构建产物验证通过；PR 经 Copilot review、CI 和 secret scanning 后 squash merge。
