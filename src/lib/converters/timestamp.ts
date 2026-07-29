import { ConversionError } from './utils';

export function timestampToDateTime(input: string): string {
  const trimmed = input.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) throw new ConversionError('请输入 Unix timestamp');
  const numeric = Number(trimmed);
  const milliseconds = Math.abs(numeric) >= 100_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) throw new ConversionError('Timestamp 超出有效范围');
  return date.toISOString();
}

export function dateTimeToTimestamp(input: string): string {
  if (!input.trim()) throw new ConversionError('请输入 DateTime');
  const milliseconds = Date.parse(input.trim());
  if (Number.isNaN(milliseconds)) throw new ConversionError('DateTime 格式无效，请使用 ISO 8601');
  return String(Math.floor(milliseconds / 1000));
}
