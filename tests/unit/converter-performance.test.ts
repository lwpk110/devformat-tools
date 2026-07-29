import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { supportedConverters } from '../../src/lib/converters';

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

describe('转换性能预算', () => {
  const payload = 'x'.repeat(1024 * 1024);
  const jsonInput = JSON.stringify({ payload });
  const benchmarkInputs: Record<string, string> = {
    'csv-to-json': `payload\n${payload}`,
    'base64-encode': payload,
    'base64-decode': btoa('x'.repeat(768 * 1024)),
    'yaml-to-json': `payload: ${payload}`,
    'xml-to-json': `<root>${payload}</root>`,
    'timestamp-to-datetime': '1704067200',
    'datetime-to-timestamp': '2024-01-01T00:00:00Z',
  };

  it('基准输入至少为 1MB', () => {
    expect(Buffer.byteLength(jsonInput)).toBeGreaterThanOrEqual(1024 * 1024);
  });

  it.each(Object.entries(supportedConverters))('%s 的中位耗时小于 100ms', (slug, converter) => {
    const input = benchmarkInputs[slug] ?? jsonInput;
    converter(input);
    const durations = Array.from({ length: 7 }, () => {
      const startedAt = performance.now();
      converter(input);
      return performance.now() - startedAt;
    });

    expect(median(durations)).toBeLessThan(100);
  });
});
