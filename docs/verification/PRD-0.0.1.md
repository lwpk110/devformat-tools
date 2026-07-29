# DevFormat.tools PRD 0.0.1 验收报告

## 验收范围

本报告对应 `docs/PRD-0.0.1.md`，证据来自当前源码、Vitest、Astro diagnostics、静态构建产物、Lighthouse 和安全扫描。应用版本为 `0.0.1`，Node.js 20，Astro 4.16.19。

## 需求证据矩阵

| 需求 | 状态 | 权威证据 |
|---|---|---|
| US-001.1：JSON 驱动独立静态页面 | 通过 | `dist.test.ts` 核对数据项与 `dist/convert/*/index.html` 一一对应；构建生成 5 个页面 |
| US-001.2：LCP <= 1.2s | 本地通过，部署待复验 | 三轮移动端 production preview LCP 为 755.98ms、753.88ms、757.81ms；`lighthouserc.json` 将 1200ms 设为 error threshold |
| US-001.3：SoftwareApplication JSON-LD | 通过 | 构建测试逐页解析 JSON-LD 并核对 type、URL、类别、OS 和免费 Offer |
| US-001.4：Canonical 与 OpenGraph | 通过 | 构建测试逐页核对绝对 canonical、og:title 与 og:url；Layout 同时输出 description/type/site_name |
| US-002.1：纯客户端转换 | 通过 | converter 为纯函数；组件安全测试和 full security scan 均确认无 fetch/XHR/POST/HTML 注入路径 |
| US-002.2：非法输入友好错误 | 通过 | utils 与组件测试覆盖空输入、非 object、多行语法错误、红色 alert 和行列位置 |
| US-002.3：1MB <100ms | 通过 | `converter-performance.test.ts` 对 5 个转换器执行预热和 7 轮中位数断言 |
| US-003.1：Copy + 2 秒状态 | 通过 | fake timer 组件测试核对 Clipboard 内容、`Copied!` 与 2000ms 恢复 |
| US-003.2：Clear | 通过 | 组件测试核对输入、输出、错误状态与按钮禁用 |
| US-003.3：Load Example | 通过 | 组件测试核对恢复 sampleInput 并生成 sampleOutput |
| 用户故事下载意图 | 通过 | Blob 测试核对目标扩展名下载、anchor click 和 object URL revoke |
| US-004.1：sitemap 自动覆盖 | 通过 | `sitemap-index.xml` 与 `sitemap-0.xml` 存在，构建测试核对首页及全部 5 个 slug |
| US-004.2：robots 绝对路径 | 通过 | endpoint 单测与 dist 测试均核对完整 `Sitemap: https://devformat.tools/sitemap-index.xml` |

## 安全审计

- `npx -y @claude-flow/cli security scan --depth full`：0 critical、0 high、0 medium、0 low。
- `npm audit --omit=dev --registry=https://registry.npmjs.org`：0 vulnerabilities。
- 完整 `npm audit` 会报告 Astro 4/Vite/sharp 的 build/dev-server 公告。PRD 明确要求 Astro 4，因此未擅自升级 major；本站只对仓库内可信静态数据执行构建，部署不包含 Node dependencies，也不启用 Astro server、server islands、middleware、image endpoint 或 Vite dev server。该风险边界记录于 ADR-001。

## Lighthouse 结果

2026-07-28 使用 Google Chrome 对 `npm run preview` 执行三轮 Lighthouse 默认 mobile throttling：

| Run | Performance | Accessibility | Best Practices | SEO | LCP |
|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 95 | 100 | 100 | 755.98ms |
| 2 | 100 | 95 | 100 | 100 | 753.88ms |
| 3 | 100 | 95 | 100 | 100 | 757.81ms |

三轮均通过 `lighthouserc.json` 的 assertions。原始 HTML/JSON 报告写入 gitignored 的 `docs/verification/lighthouse/`，可用 README 中的命令重复生成。

## 部署后复验

本地 Lighthouse 可以证明当前构建和 hydration 的性能预算，但不能模拟 CDN、DNS 和真实用户网络。Cloudflare Pages/Vercel 预览部署后必须将 `lighthouserc.json` 的 URL 替换为预览地址并复跑三次；LCP 任一聚合断言超过 1200ms 都视为未通过，不得放宽阈值。
