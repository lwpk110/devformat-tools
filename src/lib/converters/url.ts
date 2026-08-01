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
