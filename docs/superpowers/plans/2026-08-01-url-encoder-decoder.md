# URL Encoder / Decoder 工具实施计划

**目标：** 在 `/convert/url-encode/` 发布浏览器内运行的双向 URL Encoder / Decoder，并通过 Issue #31、PR、Copilot 审查、CI、secret scanning 和 squash merge 完成交付。

**架构：** `src/lib/converters/url.ts` 封装 ECMAScript 的 `encodeURIComponent` / `decodeURIComponent`，把原生解码异常映射为 `ConversionError`。`converters.json` 是页面、SEO、目录和 sitemap 的事实来源，`ConverterTool` 和 `toolCatalog` 无需功能改动。

**技术栈：** TypeScript、Web Platform API、Vitest、Astro 4、GitHub Actions。

## 全局约束

- 使用 URL component 语义：空格为 `%20`，`+` 是字面加号，不转换为空格。
- 不引入依赖、网络请求、存储、独立 UI 组件或新路由机制。
- 解码无效的百分号转义必须抛出 `ConversionError('URL 编码格式无效')`。
- 新条目不设置 `featuredRank`，不能改变 Popular tools 的现有排序。
- 每项原子任务在验证和提交后立即 push；禁止向 `main` 直接提交或推送。

## 文件结构

- 新建 `src/lib/converters/url.ts`：URL component 编码、解码与错误映射。
- 修改 `src/lib/converters/index.ts`：注册 `url-encode`、`url-decode`。
- 修改 `src/data/converters.json`：增加 canonical 工具的 SEO、样例、FAQ 与正文。
- 修改 `tests/unit/converters.test.ts`：覆盖编码、可逆性、`+` 语义和非法输入。
- 修改 `tests/unit/converters-data.test.ts`：将 canonical converter 数量更新为 10，锁定新 slug 与非精选排序。
- 修改 `tests/unit/tool-catalog.test.ts`：将目录总数更新为 11，锁定 Encoding 目录条目与 Popular tools 边界。

## Task 1：以 RED-GREEN 建立 URL component 转换器

**文件：**

- 新建：`src/lib/converters/url.ts`
- 修改：`src/lib/converters/index.ts`
- 修改：`tests/unit/converters.test.ts`

### Step 1：编写失败的行为测试

在 `tests/unit/converters.test.ts` 的“高频双向转换”中加入：

```ts
  it('URL component 编码保留加号语义并支持 Unicode', () => {
    const input = 'Hello World + / 你好🚀';
    const encoded = 'Hello%20World%20%2B%20%2F%20%E4%BD%A0%E5%A5%BD%F0%9F%9A%80';

    expect(convert('url-encode', input)).toBe(encoded);
    expect(convert('url-decode', encoded)).toBe(input);
    expect(convert('url-decode', 'a+b')).toBe('a+b');
  });

  it('URL 解码拒绝非法百分号转义', () => {
    expect(() => convert('url-decode', 'value%ZZ')).toThrow(
      new ConversionError('URL 编码格式无效'),
    );
  });
```

### Step 2：运行测试确认 RED

运行：

```bash
npm test -- tests/unit/converters.test.ts
```

预期：新增测试失败，原因是 `url-encode` 和 `url-decode` 尚未注册；既有测试保持通过。

### Step 3：实现最小纯转换函数并注册

创建 `src/lib/converters/url.ts`：

```ts
import { ConversionError } from './utils';

export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

export function decodeUrl(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    throw new ConversionError('URL 编码格式无效');
  }
}
```

在 `src/lib/converters/index.ts` 顶部导入 `decodeUrl`、`encodeUrl`，并在 `supportedConverters` 中、Base64 direction 后加入：

```ts
  'url-encode': encodeUrl,
  'url-decode': decodeUrl,
```

### Step 4：运行测试确认 GREEN

运行：

```bash
npm test -- tests/unit/converters.test.ts
npm test -- tests/unit/converter-performance.test.ts
```

预期：功能与性能测试通过；新增 direction 的 1MB 基准输入使用现有 JSON fallback，且中位耗时低于 150ms。

### Step 5：提交并推送原子实现

运行：

```bash
git add src/lib/converters/url.ts src/lib/converters/index.ts tests/unit/converters.test.ts
git diff --cached --check
git commit -m 'feat(converter): 支持 URL 编码与解码'
git push
```

预期：实现、注册和直接行为测试位于单一聚焦提交，远端功能分支更新。

## Task 2：发布元数据并锁定目录、路由与静态产物

**文件：**

- 修改：`src/data/converters.json`
- 修改：`tests/unit/converters-data.test.ts`
- 修改：`tests/unit/tool-catalog.test.ts`

### Step 1：编写失败的数据和目录契约

将 `tests/unit/converters-data.test.ts` 中的长度改为 10，并将预期 slug 数组在 `base64` 后增加 `url-encode`。将第二个测试整体替换为：

```ts
  it('按 SEO 优先级发布五个精选双向工具、一个普通双向工具和四个专业生成器', () => {
    expect(converters.map(({ slug }) => slug)).toEqual([
      'json-csv',
      'base64',
      'url-encode',
      'json-yaml',
      'json-xml',
      'unix-timestamp',
      'json-to-go-struct',
      'json-to-typescript',
      'json-to-python-dataclass',
      'json-to-rust-struct',
    ]);

    const featured = converters.filter(({ featuredRank }) => featuredRank !== undefined);
    expect(featured.map(({ featuredRank }) => featuredRank)).toEqual([1, 2, 3, 4, 5]);
    expect(featured.every(({ directions }) => directions.length === 2)).toBe(true);
    expect(converters.find(({ slug }) => slug === 'url-encode')).toEqual(
      expect.objectContaining({ category: 'Encoding', featuredRank: undefined, directions: expect.any(Array) }),
    );
    expect(converters.filter(({ directions }) => directions.length === 1)).toHaveLength(4);
  });
```

将 `tests/unit/tool-catalog.test.ts` 中 `toolCatalog` 长度改为 11，并新增：

```ts
    expect(toolCatalog).toContainEqual(expect.objectContaining({
      id: 'url-encode',
      name: 'Text ↔ URL encoded',
      href: '/convert/url-encode/',
      category: 'Encoding',
      kind: 'converter',
    }));
    expect(popularTools.map(({ id }) => id)).not.toContain('url-encode');
```

### Step 2：运行测试确认 RED

运行：

```bash
npm test -- tests/unit/converters-data.test.ts tests/unit/tool-catalog.test.ts
```

预期：测试失败，原因是 URL converter metadata 尚未发布。

### Step 3：新增 canonical converter metadata

在 `src/data/converters.json` 的 `base64` 条目后增加 `url-encode`，不设 `featuredRank`，内容使用：

```json
{
  "slug": "url-encode",
  "category": "Encoding",
  "title": "URL Encoder & Decoder Online - Free and Private",
  "description": "Encode text for URL components or decode percent-encoded URLs locally in your browser. Unicode-safe, instant and no uploads.",
  "directions": [
    {
      "id": "url-encode",
      "from": "Text",
      "to": "URL encoded",
      "sampleInput": "Hello World + 你好",
      "sampleOutput": "Hello%20World%20%2B%20%E4%BD%A0%E5%A5%BD",
      "downloadExtension": "txt",
      "summary": "Encode text safely for a URL path, query value or fragment."
    },
    {
      "id": "url-decode",
      "from": "URL encoded",
      "to": "Text",
      "sampleInput": "Hello%20World%20%2B%20%E4%BD%A0%E5%A5%BD",
      "sampleOutput": "Hello World + 你好",
      "downloadExtension": "txt",
      "summary": "Decode percent-encoded URL component text into readable text."
    }
  ],
  "faq": [
    {
      "q": "What does URL encoding do?",
      "a": "URL encoding replaces characters that have special URL meanings with percent-encoded UTF-8 bytes, so text can safely appear in a URL path, query value or fragment."
    },
    {
      "q": "Does this tool treat plus as a space?",
      "a": "No. This tool uses URL component encoding, where plus is a literal character. It encodes + as %2B and decodes + back to +."
    },
    {
      "q": "Why does a space become %20 instead of +?",
      "a": "%20 is the standard URL component representation for a space. The + convention belongs to HTML form encoding and is not applied here."
    },
    {
      "q": "Does URL encoding support Unicode and emoji?",
      "a": "Yes. Text is encoded as UTF-8 percent escapes, so CJK characters, accented text and emoji round-trip correctly."
    },
    {
      "q": "Why can URL decoding fail?",
      "a": "Decoding requires complete valid percent escapes. Inputs such as %ZZ, a trailing percent sign or invalid UTF-8 bytes cannot be decoded."
    },
    {
      "q": "Is my URL text uploaded?",
      "a": "No. Encoding and decoding run in your browser memory. Nothing is uploaded, stored or logged on a server."
    }
  ],
  "content": [
    {
      "heading": "URL component encoding",
      "body": [
        "URLs reserve characters such as spaces, slashes, question marks and hashes for structure. Percent encoding represents the UTF-8 bytes of text with a percent sign and two hexadecimal digits, letting a value travel safely inside a path segment, query value or fragment.",
        "This converter uses encodeURIComponent, the browser API for encoding a single URL component. It does not parse or rewrite a complete URL, so protocol, host and separators stay outside the text you encode."
      ]
    },
    {
      "heading": "Plus signs and form encoding",
      "body": [
        "A plus sign is ordinary text in a URL component. This tool encodes it as %2B and leaves an input plus sign unchanged when decoding, preserving values such as C++ and a+b exactly.",
        "Some HTML forms use application/x-www-form-urlencoded, where plus represents a space. That is a different format with different rules; use a dedicated form encoder when that server-side convention is required."
      ]
    },
    {
      "heading": "Decode URLs safely",
      "body": [
        "Valid percent-encoded text can be decoded back to readable Unicode, including Chinese, accented characters and emoji. Decoding is reversible when the source used URL component encoding.",
        "Malformed escapes such as %ZZ or a lone percent sign are rejected instead of being partially changed. Correct the source text before decoding so that its meaning stays unambiguous."
      ]
    }
  ]
}
```

补齐至少六个 FAQ 与三个正文段落：解释 URL component、百分号编码、`+` 不代表空格、Unicode、本地隐私和无效输入。文案不使用 `Swap`。

### Step 4：运行契约与完整质量门禁

运行：

```bash
npm test -- tests/unit/converters.test.ts tests/unit/converters-data.test.ts tests/unit/tool-catalog.test.ts tests/unit/converter-performance.test.ts
npm run check
npm run build
npm run verify:build
npm test
```

预期：数据样例契约、工具目录、性能、类型检查、构建、sitemap 和全部单元测试通过；`dist/convert/url-encode/index.html` 存在且 sitemap 收录该 canonical URL。

### Step 5：提交并推送元数据与验证测试

运行：

```bash
git add src/data/converters.json tests/unit/converters-data.test.ts tests/unit/tool-catalog.test.ts
git diff --cached --check
git commit -m 'feat(catalog): 发布 URL 编码工具页面'
git push
```

预期：发布数据与其目录契约在单一聚焦提交中，远端功能分支更新。

## Task 3：PR、Copilot 审查与合并闭环

### Step 1：创建 Draft PR

使用 `gh pr create --draft` 创建目标 `main` 的 PR，标题为 `feat: 增加 URL 编码与解码工具`。正文包含 `Closes #31`、URL component 语义、未采用 form 语义的原因、风险与已运行的验证。

### Step 2：转为 Ready 并请求 Copilot review

所有任务完成且本地质量门禁通过后，执行：

```bash
gh pr ready <pr-number> --repo lwpk110/devformat-tools
gh api --method POST repos/lwpk110/devformat-tools/pulls/<pr-number>/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
gh pr view <pr-number> --repo lwpk110/devformat-tools --json requestedReviewers
```

预期：`requestedReviewers` 中出现 `Copilot`。不能使用 `gh pr create --reviewer Copilot`，该 CLI 将 Copilot 当作普通用户而失败。

### Step 3：处理审查、CI 与安全检查

等待并检查：

```bash
gh pr checks <pr-number> --repo lwpk110/devformat-tools --watch --interval 10
gh pr view <pr-number> --repo lwpk110/devformat-tools --json reviews,reviewDecision,mergeStateStatus,isDraft
git diff --check origin/main...HEAD
```

对有效 unresolved feedback 做最小修复，重新执行完整门禁、提交、push 并重新请求 Copilot review。确认 diff 没有凭据、私钥、token、构建产物或依赖目录；如果 secret scanning 有发现，停止合并并报告路径和风险类型，不输出敏感值。

### Step 4：squash merge 与完成复核

仅在 Ready、CI 全绿、Copilot review 已完成且没有有效 unresolved feedback、PR 可合并和 secret scanning 无阻塞发现时运行：

```bash
gh pr merge <pr-number> --repo lwpk110/devformat-tools --squash --delete-branch
git fetch origin --prune
git switch main
git pull --ff-only origin main
git branch -d feat/31-url-encoder-decoder
gh issue view 31 --repo lwpk110/devformat-tools --json state,url
```

预期：PR merged、Issue #31 closed、远端功能分支删除，本地 `main` 与 `origin/main` 一致。
