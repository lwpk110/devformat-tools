import { ConversionError } from './utils';

function jsonValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCell(value: unknown): string {
  const text = jsonValue(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function jsonToCsv(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    throw new ConversionError('JSON 语法错误，请检查输入');
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (rows.length === 0) throw new ConversionError('JSON array 不能为空');
  if (rows.some((row) => typeof row !== 'object' || row === null || Array.isArray(row))) {
    throw new ConversionError('JSON 必须是 object 或 object array');
  }

  const objects = rows as Record<string, unknown>[];
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  if (headers.length === 0) throw new ConversionError('JSON object 不能没有字段');
  return [
    headers.map(escapeCell).join(','),
    ...objects.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n');
}

function parseRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (quoted) throw new ConversionError('CSV 引号未闭合');
  row.push(cell);
  rows.push(row);
  return rows.filter((cells, index) => index === 0 || cells.some((value) => value !== ''));
}

export function csvToJson(input: string): string {
  if (!input.trim()) throw new ConversionError('请输入 CSV');
  const [headers, ...rows] = parseRows(input);
  if (!headers || headers.length === 0 || headers.some((header) => !header.trim())) {
    throw new ConversionError('CSV header 不能为空');
  }
  if (new Set(headers).size !== headers.length) throw new ConversionError('CSV header 不能重复');
  const result = rows.map((row, rowIndex) => {
    if (row.length !== headers.length) throw new ConversionError(`CSV 第 ${rowIndex + 2} 行列数不一致`);
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  });
  return JSON.stringify(result, null, 2);
}
