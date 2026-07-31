import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildOutputDocument,
  convertInput,
  EXAMPLE_SESSION,
  sanitizeArchiveEntryName,
  sanitizeFileToken,
  SESSION_FORMAT_LABELS,
  type ConvertedSession,
  type ConvertError,
  type SessionFormat,
} from '../lib/session/converter';
import { buildZipBlob } from '../lib/session/zip';

const FORMATS: SessionFormat[] = ['sub2api', 'cpa', 'cockpit', '9router', 'axonhub', 'codexmanager'];

const editor =
  'min-h-64 resize-y rounded-xl border border-stone-300 p-4 font-mono text-[13px] leading-6 text-stone-900 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10 w-full';
const secondaryBtn =
  'rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';

interface Stats {
  count: number;
  errors: number;
  format: SessionFormat;
}

export function SessionConverter() {
  const [format, setFormat] = useState<SessionFormat>('sub2api');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [converted, setConverted] = useState<ConvertedSession[]>([]);
  const [skipped, setSkipped] = useState<ConvertError[]>([]);
  const [cpaExpirePlus24h, setCpaExpirePlus24h] = useState(false);
  const [omitIdToken, setOmitIdToken] = useState(false);
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

  const doConvert = useCallback(
    (text: string, fmt: SessionFormat, plus24: boolean, omit: boolean) => {
      if (!text.trim()) {
        setOutput('');
        setConverted([]);
        setSkipped([]);
        setStatus({ text: '', type: '' });
        return;
      }
      const result = convertInput(text, { cpaExpirePlus24h: plus24, sourceName: 'pasted-json' });
      setConverted(result.converted);
      setSkipped(result.skipped);
      if (result.converted.length > 0) {
        const doc = buildOutputDocument(result.converted, fmt, omit);
        setOutput(JSON.stringify(doc, null, 2));
        setStatus({
          text: `成功转换 ${result.converted.length} 个账号${result.skipped.length ? `，跳过 ${result.skipped.length} 项` : ''}`,
          type: 'ok',
        });
      } else {
        setOutput('');
        setStatus({ text: result.skipped[0]?.reason ?? '未找到可转换的 session', type: 'error' });
      }
    },
    [],
  );

  const scheduleConvert = useCallback(
    (text: string, fmt: SessionFormat, plus24: boolean, omit: boolean) => {
      if (convertTimer.current) clearTimeout(convertTimer.current);
      convertTimer.current = setTimeout(() => doConvert(text, fmt, plus24, omit), 300);
    },
    [doConvert],
  );

  const handleInputChange = (value: string) => {
    setInput(value);
    setCopied(false);
    scheduleConvert(value, format, cpaExpirePlus24h, omitIdToken);
  };

  const handleFormatChange = (fmt: SessionFormat) => {
    setFormat(fmt);
    setCopied(false);
    doConvert(input, fmt, cpaExpirePlus24h, omitIdToken);
  };

  const handlePlus24h = (checked: boolean) => {
    setCpaExpirePlus24h(checked);
    doConvert(input, format, checked, omitIdToken);
  };

  const handleOmitIdToken = (checked: boolean) => {
    setOmitIdToken(checked);
    if (converted.length > 0) {
      const doc = buildOutputDocument(converted, format, checked);
      setOutput(JSON.stringify(doc, null, 2));
    }
  };

  const handleLoadExample = () => {
    const text = JSON.stringify(EXAMPLE_SESSION, null, 2);
    setInput(text);
    setCopied(false);
    doConvert(text, format, cpaExpirePlus24h, omitIdToken);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setConverted([]);
    setSkipped([]);
    setStatus({ text: '', type: '' });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => /\.(json|txt)$/i.test(f.name));
    if (!accepted.length) {
      setStatus({ text: '没有选择 JSON/TXT 文件', type: 'error' });
      return;
    }
    const docs: unknown[] = [];
    const errors: ConvertError[] = [];
    for (const file of accepted) {
      try {
        const text = await file.text();
        // 直接拼接读取，convertInput 会从 JSON 中收集 session 对象
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) docs.push(...parsed);
        else docs.push(parsed);
      } catch {
        // 非 JSON 整体，尝试直接作为输入文本
        const text = await file.text();
        docs.push(text);
      }
    }
    const combined = JSON.stringify(docs.length === 1 ? docs[0] : docs);
    setInput(combined);
    doConvert(combined, format, cpaExpirePlus24h, omitIdToken);
    void errors;
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // fallback
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!output || converted.length === 0) return;
    const isCpaZip = format === 'cpa' && converted.length > 1;
    if (isCpaZip) {
      const usedNames = new Map<string, number>();
      const entries = converted.map((item, index) => {
        const base = sanitizeArchiveEntryName(item.name || item.email || `account-${index + 1}`, `account-${index + 1}`);
        const seen = usedNames.get(base) ?? 0;
        usedNames.set(base, seen + 1);
        const fileName = `${seen ? `${base}-${seen + 1}` : base}.json`;
        return {
          name: fileName,
          text: JSON.stringify(buildOutputDocument([item], 'cpa', omitIdToken), null, 2),
        };
      });
      const blob = buildZipBlob(entries);
      triggerDownload(blob, 'chatgpt-sessions.zip');
    } else {
      const ext = format === 'sub2api' ? 'sub2api.json' : `${format}.json`;
      const name = converted[0]?.name || converted[0]?.email;
      const fileName = `${sanitizeFileToken(name, 'chatgpt-session')}-${ext}`;
      const blob = new Blob([output], { type: 'application/json;charset=utf-8' });
      triggerDownload(blob, fileName);
    }
  };

  const stats: Stats = useMemo(
    () => ({ count: converted.length, errors: skipped.length, format }),
    [converted.length, skipped.length, format],
  );

  const downloadLabel = format === 'cpa' && converted.length > 1 ? '下载 ZIP' : '下载 JSON';

  return (
    <div className="space-y-5">
      {/* 格式切换 */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="输出格式">
        {FORMATS.map((fmt) => (
          <button
            key={fmt}
            type="button"
            role="tab"
            aria-pressed={format === fmt}
            onClick={() => handleFormatChange(fmt)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              format === fmt
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-stone-300 bg-white text-stone-600 hover:border-stone-500 hover:text-stone-950'
            }`}
          >
            {SESSION_FORMAT_LABELS[fmt]}
          </button>
        ))}
      </div>

      {/* 选项 */}
      <div className="flex flex-wrap gap-5 text-sm text-stone-600">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={cpaExpirePlus24h}
            onChange={(e) => handlePlus24h(e.currentTarget.checked)}
            className="size-4 accent-teal-700"
          />
          CPA expired 强制 +24h
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={omitIdToken}
            onChange={(e) => handleOmitIdToken(e.currentTarget.checked)}
            className="size-4 accent-teal-700"
          />
          移除 id_token 字段
        </label>
      </div>

      {/* 输入区 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">输入 ChatGPT Session JSON</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryBtn} onClick={handleLoadExample}>
              示例
            </button>
            <button type="button" className={secondaryBtn} onClick={() => fileInputRef.current?.click()}>
              上传文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <button type="button" className={secondaryBtn} onClick={handleClear}>
              清空
            </button>
          </div>
        </div>
        <textarea
          className={editor}
          placeholder='粘贴 ChatGPT session JSON，例如 {"accessToken":"...","user":{"email":"..."},"account":{"id":"..."}}'
          value={input}
          onChange={(e) => handleInputChange(e.currentTarget.value)}
          spellCheck={false}
          rows={10}
        />
        {status.text && (
          <p
            className={`mt-2 text-sm ${status.type === 'error' ? 'text-red-700' : 'text-teal-800'}`}
            role={status.type === 'error' ? 'alert' : 'status'}
          >
            {status.text}
          </p>
        )}
      </div>

      {/* 输出区 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">
            输出 · {SESSION_FORMAT_LABELS[format]}
            {stats.count > 0 && <span className="ml-2 text-stone-500">（{stats.count} 个账号）</span>}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryBtn} onClick={handleCopy} disabled={!output}>
              {copied ? '已复制' : '复制'}
            </button>
            <button type="button" className={secondaryBtn} onClick={handleDownload} disabled={!output}>
              {downloadLabel}
            </button>
          </div>
        </div>
        <textarea className={editor} value={output} readOnly rows={12} placeholder="转换结果将显示在此处" spellCheck={false} />
      </div>

      {/* 统计 */}
      {converted.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-stone-500">
          <span>
            成功 <strong className="text-stone-900">{stats.count}</strong>
          </span>
          {stats.errors > 0 && (
            <span>
              跳过 <strong className="text-red-700">{stats.errors}</strong>
            </span>
          )}
          <span>
            全程本地处理，<strong className="text-teal-800">不上传</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
