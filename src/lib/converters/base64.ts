import { ConversionError } from './utils';

const BINARY_CHUNK_SIZE = 0x8000;

function bytesToBinary(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BINARY_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BINARY_CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }
  return chunks.join('');
}

export function encodeBase64(input: string): string {
  if (!input) throw new ConversionError('请输入要编码的文本');
  return btoa(bytesToBinary(new TextEncoder().encode(input)));
}

export function decodeBase64(input: string): string {
  const normalized = input.replaceAll(/\s/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new ConversionError('Base64 格式无效');
  }
  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ConversionError('Base64 不是有效的 UTF-8 文本');
  }
}
