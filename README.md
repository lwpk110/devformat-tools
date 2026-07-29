# DevFormat.tools

DevFormat.tools 是一个由 Astro 静态生成的开发者转换工具站。首版提供 JSON 到 Go Struct、TypeScript Interface、YAML、Python Dataclass 和 Rust Struct 的转换；输入只在浏览器内存中处理，不上传、不持久化。

## 快速开始

要求 Node.js >= 18，推荐 Node.js 20。

```bash
npm install
npm run dev
```

本地开发地址由 Astro 输出，通常为 `http://localhost:4321`。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动 Astro 开发服务器 |
| `npm test` | 运行全部 Vitest 测试 |
| `npm run check` | 执行 Astro/TypeScript 严格检查 |
| `npm run build` | 生成 `dist/` 静态产物 |
| `npm run verify:build` | 验证页面、SEO、robots 与 sitemap 产物 |
| `npm run preview` | 本地预览生产构建 |

完整质量门禁：

```bash
npm test
npm run check
npm run build
npm run verify:build
npm audit --omit=dev --registry=https://registry.npmjs.org
```

## 架构

- `src/data/converters.json` 是页面矩阵、SEO 文案、样例和 FAQ 的唯一事实来源。
- `src/pages/convert/[slug].astro` 在构建期为每个 slug 生成静态 HTML。
- `src/components/ConverterTool.tsx` 是唯一的 React island，负责 Convert、Copy、Clear、Load Example 和 Download。
- `src/lib/converters/` 是无 DOM、无网络依赖的纯 TypeScript 转换引擎。
- `src/layouts/Layout.astro` 统一输出 canonical、OpenGraph 和 SoftwareApplication JSON-LD。

详细取舍见 [技术设计](docs/superpowers/specs/2026-07-28-devformat-tools-design.md) 与 [ADR-001](docs/decisions/ADR-001-astro-static-local-first.md)。

## 添加转换器

1. 先在 `tests/unit/converters.test.ts` 写目标行为并观察失败。
2. 在 `src/lib/converters/` 增加纯函数，并注册到 `index.ts`。
3. 在 `converters.json` 增加唯一 slug、SEO 文案、样例和 FAQ。
4. 运行完整质量门禁，确认新页面与 sitemap 自动出现。

转换函数统一签名为 `(input: string) => string`。不要在 converter 或组件中加入 `fetch`、XHR、表单 POST 或任何用户内容上报。

## 参与贡献

提交信息采用 Conventional Commits 规范，具体格式、类型与提交前检查见 [贡献指南](CONTRIBUTING.md)。

## 部署

Cloudflare Pages 与 Vercel 均使用：

- Build command：`npm run build`
- Output directory：`dist`
- Node.js：20
- 环境变量：无

部署预览后，使用 `lighthouserc.json` 执行真实 LCP 门禁；配置要求移动端 LCP <= 1200ms。

```bash
npx -y @lhci/cli@0.15.1 autorun
```

## 安全边界

生产部署只包含 `dist/`，Node/Astro/React 均为 build-only `devDependencies`。`npm audit --omit=dev` 对实际生产依赖执行审计；完整 build tool audit 的 Astro 4 历史公告及适用性记录在 [PRD 验收报告](docs/verification/PRD-0.0.1.md)。
