# Google SEO 转换工具需求调研

日期：2026-07-29

## 结论

首发流量入口应优先覆盖五组高频意图，并按以下顺序放在首页首屏后的 `Popular conversions`：

1. JSON ↔ CSV
2. Base64 Encode ↔ Decode
3. JSON ↔ YAML
4. JSON ↔ XML
5. Unix Timestamp ↔ DateTime

这些词同时具备明确任务意图、稳定的开发者需求和适合浏览器本地完成的转换边界。第二梯队为 URL Encode/Decode、JSON ↔ Excel、JSON Formatter/Validator、HTML ↔ Markdown、JWT Decoder、JSON → C#、HEX ↔ RGB。现有 JSON → TypeScript、Go、Python、Rust 属于更专业的长尾需求，应继续保留并从 `All tools` 链接访问。

## 调研方法

本轮以 Google 搜索意图为中心，而不是把第三方工具站展示的结果数当成精确搜索量：

- 检查 Google Autocomplete 中转换词的补全稳定性与方向性。
- 对比 SERP 中工具页、教程页和产品页的占比，判断用户是否希望“立即完成任务”。
- 检查双向关键词是否由同一批产品满足，识别 canonical 合并机会。
- 结合现有站点能力、客户端实现成本与隐私卖点排序。

Autocomplete 和 SERP 会受地区、时间和个性化影响，因此本排序是产品优先级假设，不伪装成 Google Keyword Planner 的精确月搜索量。上线后必须由 Search Console 的真实 impressions、CTR 和平均排名修正。

## 需求分层

| 优先级 | 工具 | 主要搜索意图 | 页面策略 |
| --- | --- | --- | --- |
| P0 | JSON ↔ CSV | 数据交换、表格导入导出 | 单页双向 |
| P0 | Base64 Encode ↔ Decode | 编码、解码、调试 | 单页双向 |
| P0 | JSON ↔ YAML | 配置文件迁移 | 单页双向 |
| P0 | JSON ↔ XML | API 与遗留系统交换 | 单页双向 |
| P0 | Unix Timestamp ↔ DateTime | 日志、数据库、时区调试 | 单页双向 |
| P1 | URL Encode ↔ Decode | 查询参数调试 | 后续单页双向 |
| P1 | JSON ↔ Excel | 办公数据交换 | 后续评估文件处理 |
| P1 | JSON Formatter/Validator | 高频基础动作 | 后续独立工具 |
| P1 | HTML ↔ Markdown | 内容迁移 | 后续单页双向 |
| P1 | JWT Decoder | 身份认证调试 | 后续只读工具 |
| P2 | JSON → TypeScript/Go/Python/Rust/C# | 类型生成 | 单向长尾页面 |
| P2 | HEX ↔ RGB | 前端颜色转换 | 后续单页双向 |

## 单页互转原则

每组可逆转换只生成一个索引页面，例如 `/convert/json-yaml/`。页面中的 `Swap` 切换转换方向，不能创建 `/json-to-yaml/` 与 `/yaml-to-json/` 两份可索引 HTML。原因包括：

- 集中外链、站内链接和用户行为信号，避免关键词内耗。
- 避免内容高度相似造成重复页面。
- 用户完成反向任务时不需要重新加载页面。
- 一份 FAQ 和静态说明可以自然覆盖两个方向的长尾关键词。

历史单向 URL 只能使用永久重定向指向新的 canonical 页面。Swap 不改变 canonical；当前方向属于客户端交互状态。

## 首页信息架构建议

- Hero：一句价值主张和本地处理承诺，不放复杂插画或大面积装饰。
- `Popular conversions`：用顺序明确的五张卡展示 P0 工具，首张为 JSON ↔ CSV。
- `All tools`：按 Data、Encoding、Time、Type Generators 分类列出全部现有工具。
- 每个入口都使用普通 `<a>`，确保无 JavaScript 时仍可抓取。

## 工具页搜索覆盖

一个双向页同时提供：

- 包含两个方向的 `<title>`、description、H1 与正文。
- 唯一 canonical URL。
- 两个方向各自的简短用法说明和示例。
- 同页 FAQ，覆盖隐私、格式边界和反向转换问题。
- Related tools 的普通文本链接，形成清晰的站内主题网络。

## 产品三角创意池

### PM 视角

1. 用 Top 5 排序聚焦首屏流量入口。
2. 对所有互转工具采用唯一页面，聚合 SEO 权重。
3. 首屏直接展示使用场景，而不是泛化品牌文案。
4. 用 Search Console 数据每八周重排一次 Popular。
5. 为后续 P1 工具保留统一 registry，不一次性扩张范围。

### Designer 视角

1. 把输入与输出作为页面视觉主体。
2. Swap 放在两个格式标签之间，方向始终可见。
3. 使用单一强调色标记主要动作和当前方向。
4. 移动端上下堆叠，Swap 仍紧邻格式标题。
5. 状态提示紧靠输出区域，避免 toast 遮挡内容。

### Engineer 视角

1. registry 以 direction ID 调度转换器。
2. 数据模型把页面元数据与方向数据分离。
3. 转换全部在客户端进行，避免数据上传。
4. 对 XML 禁用 `DOCTYPE` 和 `ENTITY`。
5. 用构建测试证明每个 canonical 只生成一份 HTML。

## 上线后八周验证

每周记录五个 P0 页面在 Search Console 中的 impressions、clicks、CTR、平均排名和查询词。第 4 周只修正标题、description 与站内链接；第 8 周再根据真实 impressions 调整首页排序。若反向词有 impressions 但排名明显落后，应先扩充同页反向说明与 FAQ，不应拆分第二页面。

成功标准：Top 5 页面均被索引；双向查询落在同一个 canonical；首页到所有工具的抓取深度不超过一次点击；没有由方向拆分造成的重复索引。
