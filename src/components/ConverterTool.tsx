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

const primaryButton =
  'rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton =
  'rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';

export function ConverterTool({ slug, directions }: ConverterToolProps) {
  const [directionIndex, setDirectionIndex] = useState(0);
  const direction = directions[directionIndex];
  const [input, setInput] = useState(direction.sampleInput);
  const [output, setOutput] = useState(direction.sampleOutput);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const runConversion = (value = input, selectedDirection = direction) => {
    try {
      const result = convert(selectedDirection.id, value);
      setOutput(result);
      setError('');
      return result;
    } catch (cause) {
      setOutput('');
      setError(errorMessage(cause));
      return '';
    }
  };

  const swapDirection = () => {
    const nextIndex = (directionIndex + 1) % directions.length;
    const nextDirection = directions[nextIndex];
    setDirectionIndex(nextIndex);
    setCopied(false);
    setError('');
    if (output) {
      setInput(output);
      runConversion(output, nextDirection);
    } else {
      setInput(nextDirection.sampleInput);
      setOutput(nextDirection.sampleOutput);
    }
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setError('');
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('复制失败，请允许浏览器访问剪贴板后重试');
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError('');
    setCopied(false);
  };

  const loadExample = () => {
    setInput(direction.sampleInput);
    runConversion(direction.sampleInput);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-${direction.id}.${direction.downloadExtension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_18px_60px_rgba(28,25,23,0.07)] sm:p-6" aria-label={`${direction.from} to ${direction.to} converter`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-5">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-950">
          <span className="rounded-md bg-stone-100 px-3 py-2">{direction.from}</span>
          {directions.length > 1 ? (
            <button type="button" aria-label="Swap direction" title="Swap direction" className="grid size-10 place-items-center rounded-full border border-stone-300 bg-white text-lg text-teal-800 transition hover:-rotate-180 hover:border-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" onClick={swapDirection}>
              ⇄
            </button>
          ) : <span aria-hidden="true" className="text-stone-400">→</span>}
          <span className="rounded-md bg-teal-50 px-3 py-2 text-teal-900">{direction.to}</span>
        </div>
        <p className="text-xs text-stone-500">Private · browser only</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          {direction.from} input
          <textarea
            aria-label={`${direction.from} input`}
            className="min-h-72 resize-y rounded-xl border border-stone-300 bg-stone-50 p-4 font-mono text-[13px] leading-6 text-stone-900 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10"
            spellCheck={false}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>

        <div className="grid content-start gap-2">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            {direction.to} output
            <textarea
              aria-label={`${direction.to} output`}
              className="min-h-72 resize-y rounded-xl border border-stone-300 bg-[#f4faf8] p-4 font-mono text-[13px] leading-6 text-stone-900 outline-none"
              readOnly
              spellCheck={false}
              value={output}
            />
          </label>
          {error && <p role="alert" className="mt-1 text-sm font-medium text-red-600">{error}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className={primaryButton} onClick={() => runConversion()}>Convert</button>
        <button type="button" className={secondaryButton} onClick={loadExample}>Load Example</button>
        <button type="button" className={secondaryButton} onClick={clear}>Clear</button>
        <span className="hidden flex-1 sm:block" />
        <button type="button" className={secondaryButton} disabled={!output} onClick={copyOutput}>
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button type="button" className={secondaryButton} disabled={!output} onClick={download}>Download</button>
      </div>
      <p className="mt-4 text-xs text-stone-500">Your data stays in this browser. Nothing is uploaded.</p>
    </section>
  );
}

export default ConverterTool;
