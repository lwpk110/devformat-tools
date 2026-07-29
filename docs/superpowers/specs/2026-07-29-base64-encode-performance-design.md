# Base64 编码性能稳定性设计

## 背景

`tests/unit/converter-performance.test.ts` 使用 1MB 输入检查各转换器的 7 次采样中位耗时，并要求低于 100ms。完整测试首次运行时 `base64-encode` 中位耗时为 188ms；按 flaky 策略单独重试后仍为 116ms，因此不能视为一次性抖动。

该问题已记录为 GitHub Issue #2。修复与 Agent Harness Issue #1 隔离，使用 `fix/2-base64-performance` 分支和独立 worktree，避免把产品性能改动混入基础设施 PR。

## 根因

当前 `encodeBase64`：

1. 使用 `TextEncoder` 将输入编码为 UTF-8 bytes。
2. 遍历每个 byte，并通过 `binary += String.fromCharCode(byte)` 逐字节扩展字符串。
3. 将完整 binary string 交给浏览器 `btoa`。

逐字节字符串拼接会执行约一百万次 JavaScript 循环和字符串扩展。在桌面负载较高时，这部分成本足以突破 100ms 预算。代码自初始提交以来未变化，因此这是既有性能敏感点，不是 Agent Harness 改动引入的回归。

## 方案比较

### 固定大小 chunk 转换（采用）

将 `Uint8Array` 按固定大小切片，使用 `String.fromCharCode(...chunk)` 一次转换一批 bytes，再拼接有限数量的字符串片段。

优点：

- 保留浏览器原生 `TextEncoder` 与 `btoa` 行为；
- 不引入 Node.js `Buffer`；
- 将循环次数从 byte 数量降低为 chunk 数量；
- 改动局部且容易通过现有功能测试验证。

限制：chunk 不能过大，否则 spread 参数可能超过引擎调用栈或参数数量限制。采用 `0x8000`（32768 bytes），对主流浏览器保留充分余量。

### Node.js Buffer（不采用）

`Buffer.from(input).toString('base64')` 性能高，但生产代码运行在浏览器，使用 Node.js 专属 API 会破坏架构边界。

### 放宽预算或增加重试（不采用）

降低门禁不能解决实现热点，增加重试会掩盖真实回归，与现有 100ms 产品预算冲突。

## 实现设计

在 `src/lib/converters/base64.ts` 增加模块内常量：

```typescript
const BINARY_CHUNK_SIZE = 0x8000
```

`encodeBase64` 保留空输入校验与 `TextEncoder`。编码后使用如下数据流：

```text
input string
  → TextEncoder
  → Uint8Array
  → 32768-byte chunks
  → String.fromCharCode(...chunk)
  → joined binary string
  → btoa
```

实现不得改变 `decodeBase64`，不得引入新依赖，也不得使用运行时环境判断。

## 行为兼容性

以下行为必须保持：

- ASCII、中文和 emoji 生成与浏览器 UTF-8 Base64 语义一致的结果；
- 1MB 大文本可以编码并由现有 decoder 还原；
- 空输入继续抛出 `ConversionError('请输入要编码的文本')`；
- API 签名仍为 `encodeBase64(input: string): string`；
- 浏览器生产构建不包含 Node.js polyfill。

## 测试策略

### RED

复用已经失败的 `tests/unit/converter-performance.test.ts` 作为性能 RED 证据。现有功能测试已经覆盖 Base64 编解码；补充一个超过单个 chunk 的 Unicode round-trip 用例，确保 chunk 边界不破坏多字节字符。

### GREEN

按顺序运行：

```bash
npm test -- tests/unit/converters.test.ts
npm test -- tests/unit/converter-performance.test.ts
npm test
npm run check
npm run build
```

性能测试必须在不修改阈值和采样数量的情况下通过。疑似 flaky 只允许重试一次；再次失败则停止交付。

## GitHub 交付

1. 在 `fix/2-base64-performance` 创建聚焦修复提交。
2. 自动 push 分支并创建关联 Issue #2 的 Draft PR。
3. 本地门禁通过后转为 Ready，请求 Copilot review。
4. 处理有效 feedback，并等待 GitHub Actions 成功。
5. 对 PR diff 执行 secret scanning。
6. 条件全部满足后自动 squash merge，关闭 Issue #2 并删除分支。
7. 将 Agent Harness 分支合并最新 `origin/main`，重新运行其完整门禁。

## 完成标准

- 现有 100ms 性能预算稳定通过；
- Base64 功能与 Unicode chunk 边界测试通过；
- 完整质量门禁通过；
- Copilot review、CI 和 secret scanning 通过；
- PR squash merge，Issue #2 关闭；
- Issue #1 工作区内容未被混入性能修复提交。
