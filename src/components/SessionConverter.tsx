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

const textareaCls =
  'w-full min-h-56 resize-y rounded-lg border border-stone-200 bg-stone-50/60 p-3.5 font-mono text-[13px] leading-6 text-stone-900 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-700/15';
const btn =
  'rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40';
const resultActionBtn =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md border-2 border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-500 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none';
const primaryResultActionBtn =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md border-2 border-teal-700 bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none';

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

function planBadge(plan: unknown): string {
  const p = String(plan ?? '').toLowerCase();
  if (p.includes('plus') || p.includes('pro')) return 'text-teal-800 bg-teal-50 border-teal-200';
  if (p.includes('team')) return 'text-indigo-800 bg-indigo-50 border-indigo-200';
  return 'text-stone-600 bg-stone-50 border-stone-200';
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

  const doConvert = useCallback((text: string, fmt: SessionFormat, plus24: boolean, omit: boolean) => {
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
        text: `已转换 ${result.converted.length} 个账号${result.skipped.length ? `，跳过 ${result.skipped.length} 项` : ''}`,
        type: 'ok',
      });
    } else {
      setOutput('');
      setStatus({ text: result.skipped[0]?.reason ?? '未找到可转换的 session', type: 'error' });
    }
  }, []);

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
    for (const file of accepted) {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) docs.push(...parsed);
        else docs.push(parsed);
      } catch {
        docs.push(text);
      }
    }
    const combined = JSON.stringify(docs.length === 1 ? docs[0] : docs);
    setInput(combined);
    doConvert(combined, format, cpaExpirePlus24h, omitIdToken);
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      /* fallback */
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
        return { name: fileName, text: JSON.stringify(buildOutputDocument([item], 'cpa', omitIdToken), null, 2) };
      });
      triggerDownload(buildZipBlob(entries), 'chatgpt-sessions.zip');
    } else {
      const ext = format === 'sub2api' ? 'sub2api.json' : `${format}.json`;
      const name = converted[0]?.name || converted[0]?.email;
      const fileName = `${sanitizeFileToken(name, 'chatgpt-session')}-${ext}`;
      triggerDownload(new Blob([output], { type: 'application/json;charset=utf-8' }), fileName);
    }
  };

  const stats = useMemo(
    () => ({ count: converted.length, errors: skipped.length, format }),
    [converted.length, skipped.length, format],
  );
  const downloadLabel = format === 'cpa' && converted.length > 1 ? '下载 ZIP' : '下载 JSON';
  const hasResult = converted.length > 0;

  return (
    <section className="space-y-4" aria-labelledby="session-workbench-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="session-workbench-heading" className="text-lg font-semibold tracking-[-0.02em] text-stone-950">
            批处理工作台
          </h2>
          <p className="mt-1 text-xs text-stone-500">粘贴数组或上传多个 JSON/TXT 文件，批量整理账号并导出。</p>
        </div>
        <p className="text-xs text-stone-400">所有处理均在浏览器本地完成</p>
      </div>

      {/* 格式 segmented control */}
      <div
        className="grid grid-cols-3 gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 sm:grid-cols-6"
        role="tablist"
        aria-label="输出格式"
      >
        {FORMATS.map((fmt) => (
          <button
            key={fmt}
            type="button"
            role="tab"
            aria-pressed={format === fmt}
            onClick={() => handleFormatChange(fmt)}
            className={`min-h-9 rounded-md px-2 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${
              format === fmt ? 'bg-teal-700 text-white shadow-sm' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            {SESSION_FORMAT_LABELS[fmt]}
          </button>
        ))}
      </div>

      {/* 双栏工作区 */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* —— 输入面板 —— */}
        <section className="rounded-xl border border-stone-200 bg-white shadow-sm" aria-label="输入">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">导入 Session</h3>
              <p className="mt-0.5 text-[11px] text-stone-400">支持单个对象、数组或多文件</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={btn} onClick={handleLoadExample}>加载示例</button>
              <button type="button" className={`${btn} border-teal-200 text-teal-800 hover:border-teal-700`} onClick={() => fileInputRef.current?.click()}>上传 JSON/TXT 文件</button>
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
              <button type="button" className={btn} onClick={handleClear}>清空</button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              className={textareaCls}
              aria-label="输入 Session JSON"
              placeholder='粘贴 ChatGPT session JSON，例如 {"accessToken":"...","user":{"email":"..."},"account":{"id":"..."}}'
              value={input}
              onChange={(e) => handleInputChange(e.currentTarget.value)}
              spellCheck={false}
              rows={10}
            />
            {status.text && (
              <p
                className={`mt-2.5 text-xs ${status.type === 'error' ? 'text-red-700' : 'text-teal-800'}`}
                role={status.type === 'error' ? 'alert' : 'status'}
              >
                {status.text}
              </p>
            )}
          </div>
        </section>

        {/* —— 输出面板 —— */}
        <section className="rounded-xl border border-stone-200 bg-white shadow-sm" aria-label="输出">
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-900">
              输出结果 · {SESSION_FORMAT_LABELS[format]}
            </h3>
          </div>

          {/* summary 统计 */}
          <div className="grid grid-cols-3 gap-px border-b border-stone-100 bg-stone-100">
            <div className="bg-white px-4 py-2.5">
              <p className="text-lg font-bold tabular-nums text-stone-900">{stats.count}</p>
              <p className="text-[11px] text-stone-500">成功</p>
            </div>
            <div className="bg-white px-4 py-2.5">
              <p className={`text-lg font-bold tabular-nums ${stats.errors ? 'text-red-700' : 'text-stone-900'}`}>
                {stats.errors}
              </p>
              <p className="text-[11px] text-stone-500">跳过</p>
            </div>
            <div className="bg-white px-4 py-2.5">
              <p className="truncate text-sm font-bold text-teal-800">{SESSION_FORMAT_LABELS[stats.format]}</p>
              <p className="text-[11px] text-stone-500">格式</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-3 sm:flex-row sm:justify-end" role="group" aria-label="结果操作">
            <button type="button" className={resultActionBtn} onClick={handleCopy} disabled={!output}>
              {copied ? '已复制' : '复制结果'}
            </button>
            <button type="button" className={primaryResultActionBtn} onClick={handleDownload} disabled={!output}>
              {downloadLabel}
            </button>
          </div>

          {/* accounts 表格 */}
          {hasResult && (
            <div className="border-b border-stone-100">
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-left text-xs" aria-label="转换账号列表">
                  <thead className="sticky top-0 bg-stone-50 text-stone-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">账号</th>
                      <th className="px-3 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 font-medium">过期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {converted.map((item, index) => {
                      const cpa = item.cpa as Record<string, unknown>;
                      const plan = cpa.id_token_synthetic ? 'plus?' : (item.cpa as Record<string, unknown>).plan_type;
                      return (
                        <tr key={`${item.email}-${index}`} className="text-stone-700">
                          <td className="max-w-0 truncate px-4 py-2 font-mono">{item.email || item.name}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${planBadge(plan)}`}>
                              {String(plan ?? '—')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-stone-500">
                            {(item.effectiveExpiresAt ?? '').slice(0, 10) || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="p-4">
            <textarea
              className={textareaCls}
              aria-label={`输出 JSON · ${SESSION_FORMAT_LABELS[format]}`}
              value={output}
              readOnly
              rows={10}
              placeholder="转换结果将显示在此处"
              spellCheck={false}
            />
          </div>
        </section>
      </div>

      {/* 选项栏 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3 text-xs text-stone-600">
        <span className="font-semibold text-stone-500">选项</span>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={cpaExpirePlus24h}
            onChange={(e) => handlePlus24h(e.currentTarget.checked)}
            className="size-3.5 accent-teal-700"
          />
          CPA expired 强制 +24h
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={omitIdToken}
            onChange={(e) => handleOmitIdToken(e.currentTarget.checked)}
            className="size-3.5 accent-teal-700"
          />
          移除 id_token 字段
        </label>
        <span className="ml-auto text-stone-400">全程本地处理 · 不上传</span>
      </div>
    </section>
  );
}
