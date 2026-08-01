# ChatGPT Session Converter 批处理工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ChatGPT Session Converter 调整为适合高频批量转换的本地批处理工作台。

**Architecture:** 保留 `src/lib/session/converter.ts` 和 ZIP 生成逻辑不变，仅在 `SessionConverter.tsx` 重排现有状态与交互层级，并通过组件测试锁定关键可见行为。Astro 页面只负责首屏文案与工具容器密度调整。

**Tech Stack:** Astro 4、React 18、TypeScript、Tailwind CSS、Vitest、Testing Library。

## Global Constraints

- 全程本地处理，不新增数据上传或持久化路径。
- 不修改六种输出格式和转换引擎契约。
- 不执行 Cloudflare 发布、push、PR 或 merge。
- 代码标识符保留英文，新增注释和文档使用中文。

### Task 1: 锁定批处理工作台关键交互

**Files:**
- Modify: `tests/component/SessionConverter.test.tsx`

**Interfaces:**
- Consumes: `SessionConverter` 现有公开渲染行为。
- Produces: 对批量导入、结果摘要、格式切换和下载主操作的可回归断言。

- [ ] **Step 1: Write the failing tests**

  覆盖：加载示例后显示成功统计和账号表格；切换格式更新结果标题；空状态下复制/下载禁用；批量 CPA 结果显示 ZIP 下载。

- [ ] **Step 2: Run the focused test**

  Run: `npm test -- tests/component/SessionConverter.test.tsx`

  Expected: 新增断言至少有一项失败，失败原因是当前页面缺少目标工作台行为。

### Task 2: 实现工作台信息层级

**Files:**
- Modify: `src/components/SessionConverter.tsx`
- Modify: `src/pages/session-converter.astro`

**Interfaces:**
- Consumes: 现有 `convertInput`、`buildOutputDocument`、`buildZipBlob` 与组件状态。
- Produces: 批量导入、格式选择、结果摘要、账号表格、JSON 详情和下载动作的紧凑工作台 UI。

- [ ] **Step 1: 调整工具容器和页面首屏间距**

  缩短页面说明与工具外层间距，把隐私提示和操作区放在首屏可见范围。

- [ ] **Step 2: 重排组件控制区和结果区**

  保留现有转换逻辑，调整 DOM 顺序、标题、状态反馈、空状态、结果摘要和响应式 class；确保所有操作按钮和表格在窄屏可用。

- [ ] **Step 3: Run focused tests**

  Run: `npm test -- tests/component/SessionConverter.test.tsx`

  Expected: SessionConverter 组件测试通过。

### Task 3: 完整质量验证

**Files:**
- No additional files.

- [ ] **Step 1: Run unit tests**

  Run: `npm test`

  Expected: 全部测试通过。

- [ ] **Step 2: Run Astro checks and build**

  Run: `npm run check && npm run build`

  Expected: 类型检查和静态构建均成功，无 Cloudflare 发布动作。

- [ ] **Step 3: Start local review server**

  Run: `npm run dev -- --host 127.0.0.1`

  Expected: 输出本地访问 URL，供人工审核桌面和移动布局。
