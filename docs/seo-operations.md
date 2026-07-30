# SEO 与网站监控运维指南

本文档归纳 DevFormat.tools 站点的全部 SEO 优化与监控集成，包括代码实现位置、外部平台配置步骤与验证方法。

## 1. 站点 SEO 基础设施

所有页面的 SEO 标签在 `src/layouts/Layout.astro` 统一输出。

| 能力 | 实现位置 | 说明 |
|---|---|---|
| canonical | `Layout.astro` | 基于 `SITE_URL` + `BASE_URL` 生成，指向实际生产域名 `https://devformat-tools.pages.dev/` |
| OpenGraph | `Layout.astro` | og:title、og:description、og:type、og:url、og:site_name、og:image |
| Twitter Card | `Layout.astro` | `summary_large_image` + twitter:image |
| sitemap | `astro.config.mjs` + `@astrojs/sitemap` | 构建期自动生成 `sitemap-index.xml` 与 `sitemap-0.xml` |
| robots.txt | `src/pages/robots.txt.ts` | 允许全部抓取并声明 sitemap index |

生产域名（canonical/sitemap/robots）由 `astro.config.mjs` 的 `SITE_URL` 环境变量控制，默认 `https://devformat-tools.pages.dev`。GitHub Pages 子路径部署通过 `SITE_URL` + `BASE_PATH` 覆盖。

## 2. 结构化数据（JSON-LD）

| Schema 类型 | 实现位置 | 作用 |
|---|---|---|
| SoftwareApplication | `Layout.astro` | 所有页面输出，声明为免费开发者应用 |
| FAQPage | `src/pages/convert/[slug].astro` | 转换页 FAQ 转为 schema.org，提升 Google 富搜索结果 |
| BreadcrumbList | `src/pages/convert/[slug].astro` | 转换页面包屑（Home → 工具名），与可视化 nav 对应 |

结构化数据可通过 [Google Rich Results Test](https://search.google.com/test/rich-results) 验证。

## 3. 社交分享卡片（og:image）

- `public/og-image.png`：1200×630 品牌分享图，匹配站点 teal/stone 配色。
- 生成脚本：`scripts/gen-og-image.mjs`（SVG + sharp），修改品牌后重新运行 `node scripts/gen-og-image.mjs` 即可重新生成。
- Layout 通过 `og:image` 与 `twitter:image` 标签引用，URL 为绝对路径（含 `SITE_URL` + `BASE_URL`）。

可通过 [Meta Tags Debugger](https://developers.facebook.com/tools/debug/) 或 [Twitter Card Validator](https://cards-dev.twitter.com/validator) 预览分享效果。

## 4. 网站监控：Cloudflare Web Analytics

隐私友好、无 cookie 的访问监控方案（类似 Google Analytics 但无需 cookie）。

- **实现**：`Layout.astro` 注入 beacon script，token 通过 `PUBLIC_CF_ANALYTICS_TOKEN` 环境变量或内置默认值提供。
- **内置默认值**：token 作为公开设计值硬编码在 Layout（`src/layouts/Layout.astro`），无需环境变量即稳定渲染。多环境区分时可设同名环境变量覆盖。
- **查看数据**：Cloudflare Dashboard → Web Analytics → 选择 `devformat-tools.pages.dev`。可查看 PV/UV/来源/国家/路径。
- **获取 token**：Cloudflare Dashboard → Web Analytics → Add a site → 填入域名 → 生成的 JS 片段中 `data-cf-beacon='{"token": "XXXX"}'` 的 `XXXX`。

## 5. 搜索排行：Google Search Console

GSC 提供 Google 搜索的曝光、点击、关键词、索引状态等数据。

### 5.1 站点所有权验证

- Layout 已注入 `google-site-verification` meta 标签，验证值通过 `PUBLIC_GOOGLE_SITE_VERIFICATION` 环境变量或内置默认值提供。
- **确认验证**：打开 [Google Search Console](https://search.google.com/search-console) → 找到 `https://devformat-tools.pages.dev/` 资源 → 点「验证」。验证通过后即解锁数据。

### 5.2 提交 Sitemap 加速收录

- GSC → 左侧「Sitemaps」→ 提交 `https://devformat-tools.pages.dev/sitemap-index.xml`。
- 提交后 Google 会定期抓取，可在 GSC 查看索引覆盖率。

### 5.3 查看搜索数据

- **效果（Performance）**：搜索查询、点击量、曝光、点击率、平均排名。
- **覆盖率（Coverage）**：已索引/未索引页面，发现抓取错误。
- **增强（Enhancements）**：FAQPage / BreadcrumbList / SoftwareApplication 富搜索结果状态。

## 6. 多部署环境 token 覆盖

监控与验证 token 的优先级：

1. 环境变量 `PUBLIC_CF_ANALYTICS_TOKEN` / `PUBLIC_GOOGLE_SITE_VERIFICATION`（若设置则覆盖默认值）
2. Layout 内置默认值

GitHub Pages 子路径部署（`deploy-github-pages.yml`）注入 `SITE_URL` + `BASE_PATH`，但监控 token 与 GSC 验证使用默认值（指向 pages.dev），无需额外配置。

## 7. SEO 验证清单

部署后可按以下清单验证 SEO 与监控是否生效：

- [ ] 访问 `https://devformat-tools.pages.dev/`，查看页面源码包含 canonical、og:image、CF beacon、google-site-verification
- [ ] 访问 `/sitemap-index.xml` 返回 200，内容指向实际域名
- [ ] 访问 `/robots.txt`，Sitemap 指向实际域名
- [ ] 转换页源码包含 FAQPage、BreadcrumbList JSON-LD
- [ ] 访问 `/og-image.png` 返回 1200×630 PNG
- [ ] GSC 验证通过并已提交 sitemap
- [ ] Cloudflare Web Analytics Dashboard 可见访问数据
