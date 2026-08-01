# 统一工具目录与首页信息架构设计

## 背景

首页的 `All tools` 仅从 `src/data/converters.json` 读取标准格式转换器。ChatGPT Session Converter 使用独立页面和交互组件，因而被手写为页面末尾的特殊区块，既不在工具总目录中，也没有稳定的排序机制。随着工具增加，这种例外会导致入口遗漏、排序不透明和重复维护。

## 目标

建立统一的工具目录，作为全站工具导航与首页展示的唯一来源；保留标准转换器的数据和静态路由模型，不把异构工具强行纳入 `ConverterData`。

## 架构

### 标准转换器数据

`src/data/converters.json` 继续只描述 JSON/CSV/YAML 等标准格式转换器，供 `src/pages/convert/[slug].astro` 生成静态 SEO 页面，并保留现有 `ConverterData` 契约。

### 统一工具目录

新增 TypeScript 工具目录，聚合标准转换器和独立工具。每一项至少包含：

- `id`：稳定的内部标识。
- `name`、`description`、`href`：首页和导航展示信息。
- `category`、`categoryRank`：分组名称及固定展示顺序。
- `homepageRank`：跨分类的精选排序，数值越小越靠前。
- `kind`：`converter` 或 `session`，用于保留工具差异但不影响目录展示。

标准转换器条目由 `converters.json` 映射生成，Session Converter 在目录中显式注册；首页不再维护额外的特例卡片。

## 首页布局

1. 首屏保留站点价值说明和工具数量，数量由统一目录派生。
2. `Popular tools` 显示有 `homepageRank` 的工具，ChatGPT Session Converter 位于前三并可直接访问。
3. `All tools` 显示统一目录中的全部工具，按 `categoryRank` 分组排序，分类内按 `homepageRank` 与名称稳定排序。
4. `Account & Session` 为第一个分类，包含 ChatGPT Session Converter；不再渲染页面底部的 `Session & account tools` 特例区块。
5. 当前工具数量较少，不增加搜索和筛选；当目录超过 12 项时，再增加浏览器端搜索和分类筛选。超过 30 项时新增独立 `/tools/` 目录页。

## 工具详情页

每个工具页面维持统一外壳：面包屑、名称、简短隐私说明、操作工作区、相关内容。具体工作区可以不同：标准转换器使用 `ConverterTool`，Session Converter 使用批处理工作台。

## 验收标准

1. ChatGPT Session Converter 同时出现在 `Popular tools` 与 `All tools` 的 `Account & Session` 分类中。
2. 首页不再有单独手写的 Session 工具区块。
3. 首页展示的工具数量来自统一工具目录，而非硬编码数字。
4. 标准转换器现有的静态路由、SEO 测试和转换数据契约不变。
5. 新增独立工具只需注册一次即可进入首页目录，且不必修改标准转换器数据结构。
6. 不执行 Cloudflare 发布、push、PR 或 merge。
