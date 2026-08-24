import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CARDKEY_FORMAT_LABELS,
  EXAMPLE_CARD_KEYS,
  generateOutput,
  parseCardKeys,
  type CardKeyOutputFormat,
  type CardKeyPlatform,
  type CardKeyRecord,
} from '../lib/cardkey/converter';

const textareaCls =
  'w-full min-h-56 resize-y rounded-lg border border-stone-200 bg-stone-50/60 p-3.5 font-mono text-[13px] leading-6 text-stone-900 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-700/15';
const btn =
  'rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40';
const resultActionBtn =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md border-2 border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-500 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none';
const primaryResultActionBtn =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md border-2 border-teal-700 bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none';

const PLATFORMS: CardKeyPlatform[] = ['grok', 'claude', 'openai', 'gemini'];
const FORMATS: CardKeyOutputFormat[] = ['sub2api', 'tokens', 'cards', 'cpa'];

function triggerDownload(content: string, fileName: string, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CardKeyConverter() {
  const [platform, setPlatform] = useState<CardKeyPlatform>('grok');
  const [format, setFormat] = useState<CardKeyOutputFormat>('sub2api');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [records, setRecords] = useState<CardKeyRecord[]>([]);
  const [status, setStatus] = useState<{ text: string; type: 'ok' | 'error' | '' }>({ text: '', type: '' });
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const convertTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (convertTimer.current) clearTimeout(convertTimer.current);
    },
    [],
  );

  const doConvert = useCallback((text: string, plat: CardKeyPlatform, fmt: CardKeyOutputFormat) => {
    if (!text.trim()) {
      setOutput('');
      setRecords([]);
      setStatus({ text: '', type: '' });
      return;
    }
    const result = parseCardKeys(text, { platform: plat, sourceName: 'pasted-cards' });
    setRecords(result.records);

    if (result.records.length > 0) {
      const outText = generateOutput(result.records, fmt, plat);
      setOutput(outText);
      setStatus({
        text: `已成功转换 ${result.records.length} 个账号${result.skipped.length ? `，忽略 ${result.skipped.length} 项格式不符` : ''}`,
        type: 'ok',
      });
    } else {
      setOutput('');
      setStatus({ text: result.skipped[0]?.reason ?? '未找到有效卡密', type: 'error' });
    }
  }, []);

  const scheduleConvert = useCallback(
    (text: string, plat: CardKeyPlatform, fmt: CardKeyOutputFormat) => {
      if (convertTimer.current) clearTimeout(convertTimer.current);
      convertTimer.current = setTimeout(() => doConvert(text, plat, fmt), 200);
    },
    [doConvert],
  );

  const handleInputChange = (value: string) => {
    setInput(value);
    scheduleConvert(value, platform, format);
  };

  const handlePlatformChange = (plat: CardKeyPlatform) => {
    setPlatform(plat);
    if (input) doConvert(input, plat, format);
  };

  const handleFormatChange = (fmt: CardKeyOutputFormat) => {
    setFormat(fmt);
    if (input) doConvert(input, platform, fmt);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const contents: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      if (f) {
        contents.push(await f.text());
      }
    }
    const merged = contents.join('\n');
    setInput(merged);
    doConvert(merged, platform, format);
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!output) return;
    const ext = format === 'tokens' || format === 'cards' ? 'txt' : 'json';
    const mimeType = ext === 'txt' ? 'text/plain' : 'application/json';
    const fileName = `sub2api_${platform}_${records.length}accounts.${ext}`;
    triggerDownload(output, fileName, mimeType);
  };

  const totalLines = useMemo(() => {
    return input ? input.split(/\r?\n/).filter(Boolean).length : 0;
  }, [input]);

  return (
    <div className="space-y-6">
      {/* 选项工具栏 */}
      <div className="rounded-xl border border-stone-200 bg-[#f8f7f3] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* 上游平台选择 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">上游平台:</span>
            <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1 shadow-sm" role="radiogroup" aria-label="目标平台">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePlatformChange(p)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    platform === p
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                  }`}
                  role="radio"
                  aria-checked={platform === p}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 快捷动作 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={btn}
            >
              📁 上传卡密 TXT/JSON 文件
            </button>
            <button
              type="button"
              onClick={() => {
                setInput(EXAMPLE_CARD_KEYS);
                doConvert(EXAMPLE_CARD_KEYS, platform, format);
              }}
              className={btn}
            >
              填入样例数据
            </button>
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  setOutput('');
                  setRecords([]);
                  setStatus({ text: '', type: '' });
                }}
                className={btn}
              >
                清空输入
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主工作区：左右双栏 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左栏：输入区域 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="cardkey-input" className="text-sm font-semibold text-stone-900">
              原始卡密文本
            </label>
            <span className="text-xs text-stone-500">
              {totalLines > 0 ? `已识别 ${totalLines} 行` : '支持 邮箱----密码----Token 或 卡密 1: 前缀'}
            </span>
          </div>
          <textarea
            id="cardkey-input"
            className={textareaCls}
            rows={14}
            placeholder={`粘贴卡密内容，例如：\n卡密 1: example@outlook.com----password123----token_abc123\n卡密 2: user2@outlook.com----password456----token_def456\n\n支持任意空行、序号前缀或多文件拖拽上传。`}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
          />
        </div>

        {/* 右栏：输出区域 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-stone-900">
              输出结果 · {CARDKEY_FORMAT_LABELS[format]}
            </h2>
            {/* 输出格式切换 Tabs */}
            <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5" role="tablist" aria-label="输出格式">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  role="tab"
                  aria-selected={format === fmt}
                  onClick={() => handleFormatChange(fmt)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    format === fmt
                      ? 'bg-teal-700 text-white'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                  }`}
                >
                  {fmt === 'sub2api' ? 'Sub2API JSON' : fmt === 'tokens' ? '纯 Token' : fmt === 'cards' ? '清洗卡密' : 'CPA'}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="cardkey-output"
            className={textareaCls}
            rows={14}
            readOnly
            placeholder="转换结果将在此处实时显示..."
            value={output}
          />
        </div>
      </div>

      {/* 状态统计栏与主要操作 */}
      {status.text && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-sm ${
            status.type === 'ok' ? 'bg-teal-50 text-teal-900 border border-teal-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            <span>{status.type === 'ok' ? '✅' : '⚠️'}</span>
            <span className="font-medium">{status.text}</span>
          </div>
          <span className="text-xs opacity-75">上游平台: {platform.toUpperCase()}</span>
        </div>
      )}

      {/* 显著操作栏 */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2" role="group" aria-label="结果操作">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!output}
          className={resultActionBtn}
        >
          {copied ? '✅ 已复制' : '复制转换结果'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!output}
          className={primaryResultActionBtn}
        >
          📥 下载 {format === 'tokens' || format === 'cards' ? 'TXT 文件' : 'JSON 文件'}
        </button>
      </div>

      {/* 解析预览表格 */}
      {records.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900">
              已识别账号列表 ({records.length})
            </h3>
            <span className="text-xs text-stone-500">
              全部在浏览器内存中处理，不离开本地设备
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-left text-xs text-stone-700" aria-label="转换账号列表">
              <thead className="sticky top-0 border-b border-stone-200 bg-stone-50 font-medium text-stone-900">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">邮箱 / 账号</th>
                  <th className="px-3 py-2">平台</th>
                  <th className="px-3 py-2">Token 片段</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {records.slice(0, 50).map((r, i) => (
                  <tr key={i} className="hover:bg-stone-50">
                    <td className="px-3 py-2 text-stone-400">{i + 1}</td>
                    <td className="px-3 py-2 text-stone-900 font-semibold">{r.email}</td>
                    <td className="px-3 py-2 text-teal-700">{r.platform}</td>
                    <td className="px-3 py-2 text-stone-500">
                      {r.token.slice(0, 12)}...{r.token.slice(-8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length > 50 && (
              <div className="p-2 text-center text-xs text-stone-500 bg-stone-50 border-t border-stone-200">
                已显示前 50 条，剩余 {records.length - 50} 条已完整包含在输出结果中
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
