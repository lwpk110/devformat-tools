# DevFormat.tools 产品策略与站内 SEO 基础设计

## 背景

DevFormat.tools 是一个以 Astro 静态生成的本地开发者转换工具站。用户在浏览器内完成格式转换，不上传、不登录，也不依赖服务端处理。生产站点已经具备 canonical URL、robots.txt、sitemap、OpenGraph、SoftwareApplication、FAQPage 和 BreadcrumbList。

2026-08-02 的线上检查确认首页、robots.txt、sitemap-index.xml、JSON CSV、URL Encoder 和 Session Converter 均返回 HTTP 200；sitemap 收录 12 个 canonical URL。现有技术基础可抓取，但首页的 title、description 和 H1 使用较泛的 "online converters" 表述，工具页的 Related tools 则直接取 `converters.json` 中除自身以外的前四项，无法表达格式与用户任务关联。

本阶段不以无法读取的 Search Console 排名数据伪造效果。它只完成符合搜索引擎规范、能通过构建测试验证的产品定位和站内 SEO 基础；Google Search Console 的 query、impressions、CTR 与平均排名将在后续复盘时作为外部证据。

## 产品策略画布

### 1. 愿景

成为开发者处理常见格式、编码和时间数据时最快、最可信的本地工具入口。每一项工具都应让用户在打开页面后立即完成任务，并确信敏感输入不会离开浏览器。

### 2. 市场分层

1. 日常数据转换开发者：在 API、数据导入、日志和配置之间处理 JSON、CSV、YAML、XML、Base64、URL 与时间戳。
2. 类型与配置维护者：从 JSON 创建目标语言类型或在配置格式之间迁移，重视可预测输出和格式边界。
3. 会话迁移高级用户：需要把 ChatGPT session 数据映射到特定本地工具格式，需求价值高但安全敏感，不能定义全站 SEO 主题。

第一分层优先，因为其搜索意图明确、问题频率高，且完全符合浏览器本地处理边界。

### 3. 相对成本

保持免费、静态托管和本地计算。成本优势来自没有用户内容存储、没有服务端转换队列和低运维负担，而非降低输出质量或增加广告干扰。

### 4. 价值主张

用户在转换前通常要在编辑器、脚本和不透明的在线服务之间切换，并担心数据上传。DevFormat.tools 在一个可索引的直达页面中提供即时、可复制、可下载的转换结果；输入只在浏览器内存中处理，转换器使用明确、可测试的格式语义。

### 5. 取舍

- 不创建仅替换关键词的方向重复页、城市页或其他薄内容 pSEO 页面。
- 不在本阶段引入账号、订阅、广告、服务端内容处理或文件上传存储。
- 不为敏感 Session Converter 扩张泛化的账户、凭证或 token SEO 内容。
- 不在没有需求与独立页面价值证据时一次性发布大量新转换器。

### 6. 核心指标

北极星指标为来自自然搜索、在工具页完成目标操作的会话数。当前没有事件级操作数据时，用 GSC 的工具页 clicks、impressions、CTR 和平均排名作为代理指标；每四周按 canonical 页面记录一次。第一季度单一重点指标是高意图工具页的自然 impressions 增长，同时不牺牲 CTR。

### 7. 增长路径

采用 product-led organic growth：搜索词进入具体工具页，工具即时完成任务，语义 Related tools 引导相邻任务，首页作为主题和工具目录入口。下一批候选按需求、独立价值、实现成本和隐私边界排序：JSON Excel、JSON C#、JSON Formatter/Validator、JWT Decoder、HTML Markdown。每一项单独验证后才进入实现，不预先生成页面。

### 8. 所需能力

需要稳定的纯前端转换模块、数据驱动静态页面、可测试的关键词与链接选择规则、GSC 周期复盘和高质量的格式说明。现有 Astro、Vitest、Cloudflare Pages 和 GitHub delivery 流程已覆盖前四项；GSC 的真实数据访问是后续唯一外部能力缺口。

### 9. 难以复制之处

初期护城河有限。可持续优势来自本地隐私承诺、严格的格式测试、快速而稳定的静态页面、每页真实的任务说明和长期积累的工具主题网络，而非规模化制造页面数量。

## SEO 审计结论

### 已验证通过

- `https://abc123456.uk/robots.txt` 允许抓取，并指向 sitemap index。
- sitemap index 与 sitemap 列出首页、10 个 canonical converter 和 Session Converter。
- 抽检的 JSON CSV、URL Encoder、Session Converter 返回 200。
- URL Encoder 页面包含唯一 title、description、canonical、SoftwareApplication、FAQPage 和 BreadcrumbList。
- 构建测试覆盖 canonical、sitemap、robots、静态正文与 JSON-LD。

### 第一阶段问题

1. 首页 title、description 和 H1 没有明确覆盖开发者格式转换主意图，首页文本比单个工具页更泛。
2. Related tools 受 JSON 数据数组顺序影响，可能把无关工具连接在一起，无法形成稳定主题簇。
3. 还未形成每四周由 Search Console 真实数据驱动的关键词复盘，但这需要资源已验证与 sitemap 已提交后才能开始。

PageSpeed 公共 API 在审计期间返回 HTTP 429，未把一次外部限流错误视为性能结论；仓库既有 Lighthouse 与构建门禁继续保留。

## 第一阶段设计

### 主页定位

将首页元数据与首屏文案调整为开发者格式转换意图，同时保留隐私与即时使用差异：

- title：`Free Online Developer Converters - Private JSON, CSV, YAML & More`
- description：`Free online developer converters for JSON, CSV, YAML, XML, Base64, timestamps and URL encoding. Fast, private browser tools with no uploads or signup.`
- eyebrow：`Local-first developer converters`
- H1：`Private developer format converters.`
- supporting copy：说明 JSON、CSV、YAML、XML、encoding 和 timestamps 在浏览器内转换，保持“不上传、不登录”的产品承诺。

这是一页主题聚合，不为所有关键词堆砌重复术语；具体格式和反向意图仍由 canonical 工具页承接。

### 语义 Related tools

新增一个纯数据选择器，由 `[slug].astro` 使用。它只针对标准 converter，不把 Session Converter 填入普通格式转换的 Related tools。

对每个候选工具计算固定相关性分数：

1. 同 category 加 4 分。
2. 任一 direction 的 `from` 或 `to` 与当前工具的任一格式相同，加 2 分。
3. 分数相同按 `slug` 升序排序，保证构建与链接稳定。
4. 排除当前工具并取前 4 项。

这会把 Encoding 工具优先关联到其他 Encoding 工具；Data 与 Type Generators 则因 JSON 或共同分类形成相邻链接。新转换器加入数据源后自动获得可解释、稳定的链接，无需手写链接阵列。

### 验证设计

- 新增选择器单元测试，覆盖同类优先、共享格式优先、排除自身、稳定 fallback 和最多四项。
- 在 SEO 源码契约测试中断言首页的 title、description、H1/首屏定位以及 converter 页面使用选择器。
- 静态产物测试继续验证所有 canonical URL、sitemap、Related tools 与 JSON-LD；增加首页关键词定位断言。
- 全部运行 `npm test`、`npm run check`、`npm run build` 与 `npm run verify:build`。

## 后续复盘与扩展门槛

GSC 验证成功且 sitemap 提交后，每四周读取每个 canonical 页面对应的 queries、impressions、clicks、CTR 与平均排名。只有满足以下条件的工具才进入独立 feature 设计：有明确重复搜索意图、可在浏览器本地正确转换、有区别于现有页的独立输入输出任务、可写出真实 FAQ/正文/样例，且不会与已有 canonical 页面竞争。

## 备选方案

### 大量生成转换页

覆盖面看似更快，但没有需求验证或独特内容时会形成薄内容、关键词内耗和额外维护成本，拒绝采用。

### 只优化 Session Converter

该工具对特定用户有价值，但会话和凭证相关意图过于敏感且与通用格式转换主题不一致，保留为独立入口而非增长主轴。

### 只改 title 和 description

这是低成本改进，但无法修正主题链接与新增工具的可扩展性。采用主页定位加语义 Related tools 的小范围组合。

## 验收标准

1. 产品策略和可验证 SEO 审计记录在此规格中。
2. 首页面向 developer format converters 的定位清晰、真实且不堆砌关键词。
3. 标准 converter 页的 Related tools 由稳定语义规则计算。
4. 不增加页面数量、不改变 canonical、robots、sitemap 或本地隐私边界。
5. 全部本地与构建门禁通过；通过 Issue、PR、Copilot review、CI 和 squash merge 交付。
