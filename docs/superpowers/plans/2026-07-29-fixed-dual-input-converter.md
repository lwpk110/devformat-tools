# 固定双输入转换器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将双向工具从 Swap 模式改为固定左右格式、中央双方向按钮的转换界面。

**Architecture:** `ConverterTool.tsx` 继续作为唯一 hydrated island，以固定的 `leftValue`、`rightValue` 和 `lastDirectionIndex` 表达交互状态。双向 direction 由按钮显式选择，单向 direction 复用同一执行路径并保持右侧只读；转换算法和数据模型不变。

**Tech Stack:** Astro 4、React 18、TypeScript、Tailwind CSS、Vitest、Testing Library

## Global Constraints

- 不新增依赖，不修改 converter registry、canonical URL 或 directions 数据契约。
- 所有转换继续在浏览器本地执行，不增加网络请求或 HTML 注入路径。
- 双向工具两侧可编辑，单向工具右侧只读。
- Desktop 三列、Mobile 上下排列；按钮具有明确方向和可访问名称。
- 使用 TDD；未观察到预期 RED 前不修改生产组件。

---

### Task 1: 固定双向编辑器与中央方向按钮

**Files:**
- Modify: `tests/component/ConverterTool.test.tsx`
- Modify: `src/components/ConverterTool.tsx`

**Interfaces:**
- Consumes: `ConverterDirection[]` 与 `convert(direction.id, value)`
- Produces: 固定左右文本框，以及 `Convert <from> to <to>` 方向按钮

- [ ] **Step 1: 写失败测试**

```tsx
render(<ConverterTool {...bidirectionalProps} />);
expect(screen.queryByRole('button', { name: 'Swap direction' })).not.toBeInTheDocument();
expect(screen.getByLabelText('Text input')).not.toHaveAttribute('readonly');
expect(screen.getByLabelText('Base64 input')).not.toHaveAttribute('readonly');
await user.click(screen.getByRole('button', { name: 'Convert Text to Base64' }));
await user.click(screen.getByRole('button', { name: 'Convert Base64 to Text' }));
```

- [ ] **Step 2: 运行 RED**

Run: `npm test -- tests/component/ConverterTool.test.tsx`

Expected: 找不到固定双向按钮，且右侧仍为只读 output。

- [ ] **Step 3: 实现最小状态模型与布局**

```tsx
const [leftValue, setLeftValue] = useState(directions[0].sampleInput);
const [rightValue, setRightValue] = useState(directions[0].sampleOutput);
const [lastDirectionIndex, setLastDirectionIndex] = useState(0);

const runDirection = (index: number) => {
  const selected = directions[index];
  const source = index === 0 ? leftValue : rightValue;
  const result = convert(selected.id, source);
  index === 0 ? setRightValue(result) : setLeftValue(result);
  setLastDirectionIndex(index);
};
```

渲染固定左右编辑器，并在中间渲染一个或两个方向按钮；单向时右侧添加 `readOnly`。

- [ ] **Step 4: 运行 GREEN**

Run: `npm test -- tests/component/ConverterTool.test.tsx`

Expected: 固定格式与双方向用例通过。

### Task 2: 适配辅助操作与错误边界

**Files:**
- Modify: `tests/component/ConverterTool.test.tsx`
- Modify: `src/components/ConverterTool.tsx`

**Interfaces:**
- Consumes: `lastDirectionIndex`、左右文本内容、direction download metadata
- Produces: 最近目标侧 Copy/Download，以及按目标侧清理的失败状态

- [ ] **Step 1: 写失败测试**

```tsx
await user.click(screen.getByRole('button', { name: 'Convert Base64 to Text' }));
await user.click(screen.getByRole('button', { name: 'Copy to Clipboard' }));
expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello');
```

同时覆盖反向失败只清空左侧、Clear 清空两侧、Load Example 恢复初始左右示例、Download 使用最近 direction 的扩展名。

- [ ] **Step 2: 运行 RED**

Run: `npm test -- tests/component/ConverterTool.test.tsx`

Expected: 辅助操作仍依赖旧 `output` 和活动 direction。

- [ ] **Step 3: 实现最近目标侧派生状态**

```tsx
const latestOutput = lastDirectionIndex === 0 ? rightValue : leftValue;
const latestDirection = directions[lastDirectionIndex];
```

Copy、Download、disabled、错误与示例操作统一使用固定左右状态。

- [ ] **Step 4: 运行 GREEN**

Run: `npm test -- tests/component/ConverterTool.test.tsx`

Expected: Component tests 全部通过。

### Task 3: 响应式与完整门禁

**Files:**
- Modify: `src/components/ConverterTool.tsx`
- Verify: `tests/component/ConverterTool.test.tsx`

**Interfaces:**
- Consumes: 现有 Tailwind tokens 与焦点样式
- Produces: Mobile 上下布局、Desktop 三列布局和可见交互状态

- [ ] **Step 1: 完成布局细化**

编辑器容器使用 `lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`；中央按钮组在 Mobile 横向、Desktop 纵向排列，保留 hover、focus、active 与 disabled 状态。

- [ ] **Step 2: 运行完整验证**

Run: `npm run check`

Expected: 0 errors / warnings / hints。

Run: `npm test`

Expected: 全部 tests 通过。

Run: `npm run build`

Expected: 10 pages 构建成功。

- [ ] **Step 3: 浏览器验收**

在 `http://localhost:4321/convert/base64/` 验证双向桌面与移动布局，在 `http://localhost:4321/convert/json-to-typescript/` 验证单向只读输出。
