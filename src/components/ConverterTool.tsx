import { useEffect, useRef, useState } from 'react';

import { convert, ConversionError } from '../lib/converters';
import type { ConverterDirection } from '../types/converter';

interface ConverterToolProps {
  slug: string;
  directions: ConverterDirection[];
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ConversionError) {
    const location = cause.line && cause.column ? `（第 ${cause.line} 行，第 ${cause.column} 列）` : '';
    return `${cause.message}${location}`;
  }
  return '转换失败，请检查输入后重试';
}

const secondaryButton =
  'rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';
const editor =
  'min-h-72 resize-y rounded-xl border border-stone-300 p-4 font-mono text-[13px] leading-6 text-stone-900 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10';
const directionButton =
  'grid size-12 place-items-center rounded-full border text-xl font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

export function ConverterTool({ slug, directions }: ConverterToolProps) {
  const initialDirection = directions[0];
  const isBidirectional = directions.length > 1;
  const [leftValue, setLeftValue] = useState(initialDirection.sampleInput);
  const [rightValue, setRightValue] = useState(initialDirection.sampleOutput);
  const [lastDirectionIndex, setLastDirectionIndex] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const latestDirection = directions[lastDirectionIndex];
  const latestOutput = lastDirectionIndex === 0 ? rightValue : leftValue;

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const runDirection = (index: number) => {
    const selectedDirection = directions[index];
    const sourceValue = index === 0 ? leftValue : rightValue;
    setLastDirectionIndex(index);
    setCopied(false);
    try {
      const result = convert(selectedDirection.id, sourceValue);
      if (index === 0) setRightValue(result);
      else setLeftValue(result);
      setError('');
    } catch (cause) {
      if (index === 0) setRightValue('');
      else setLeftValue('');
      setError(errorMessage(cause));
    }
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(latestOutput);
      setError('');
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('复制失败，请允许浏览器访问剪贴板后重试');
    }
  };

  const clear = () => {
    setLeftValue('');
    setRightValue('');
    setLastDirectionIndex(0);
    setError('');
    setCopied(false);
  };

  const loadExample = () => {
    setLeftValue(initialDirection.sampleInput);
    setRightValue(initialDirection.sampleOutput);
    setLastDirectionIndex(0);
    setError('');
    setCopied(false);
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([latestOutput], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-${latestDirection.id}.${latestDirection.downloadExtension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_18px_60px_rgba(28,25,23,0.07)] sm:p-6" aria-label={`${initialDirection.from} and ${initialDirection.to} converter`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-5">
        <p className="text-sm font-medium text-stone-700">
          {isBidirectional
            ? 'Paste either format, then choose a direction.'
            : 'Paste your source, then convert it locally.'}
        </p>
        <p className="text-xs text-stone-500">Private · browser only</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          <span className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-stone-100 px-3 py-1.5 font-semibold text-stone-950">
              {initialDirection.from}
            </span>
            <span className="text-xs font-normal text-stone-500">Input</span>
          </span>
          <textarea
            aria-label={`${initialDirection.from} input`}
            className={`${editor} bg-stone-50`}
            spellCheck={false}
            value={leftValue}
            onChange={(event) => setLeftValue(event.target.value)}
          />
        </label>

        <div
          role="group"
          aria-label="Conversion direction"
          className="flex items-center justify-center gap-3 py-1 lg:flex-col lg:pt-10"
        >
          {directions.slice(0, 2).map((selectedDirection, index) => (
            <button
              key={selectedDirection.id}
              type="button"
              aria-label={`Convert ${selectedDirection.from} to ${selectedDirection.to}`}
              title={`Convert ${selectedDirection.from} to ${selectedDirection.to}`}
              className={`${directionButton} ${index === 0 ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800' : 'border-stone-300 bg-white text-teal-800 hover:border-teal-700'}`}
              onClick={() => runDirection(index)}
            >
              <span aria-hidden="true" className="lg:hidden">{index === 0 ? '↓' : '↑'}</span>
              <span aria-hidden="true" className="hidden lg:inline">{index === 0 ? '→' : '←'}</span>
            </button>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-medium text-stone-700">
          <span className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-teal-50 px-3 py-1.5 font-semibold text-teal-900">
              {initialDirection.to}
            </span>
            <span className="text-xs font-normal text-stone-500">
              {isBidirectional ? 'Input' : 'Output'}
            </span>
          </span>
          <textarea
            aria-label={`${initialDirection.to} ${isBidirectional ? 'input' : 'output'}`}
            className={`${editor} bg-[#f4faf8]`}
            readOnly={!isBidirectional}
            spellCheck={false}
            value={rightValue}
            onChange={(event) => setRightValue(event.target.value)}
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className={secondaryButton} onClick={loadExample}>Load Example</button>
        <button type="button" className={secondaryButton} onClick={clear}>Clear</button>
        <span className="hidden flex-1 sm:block" />
        <button type="button" className={secondaryButton} disabled={!latestOutput} onClick={copyOutput}>
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button type="button" className={secondaryButton} disabled={!latestOutput} onClick={download}>Download</button>
      </div>
      <p className="mt-4 text-xs text-stone-500">Your data stays in this browser. Nothing is uploaded.</p>
    </section>
  );
}

export default ConverterTool;
