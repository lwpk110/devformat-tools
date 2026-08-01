import { ConversionError } from './utils';

export function encodeUrl(input: string): string {
  try {
    return encodeURIComponent(input);
  } catch (cause) {
    if (cause instanceof URIError) throw new ConversionError('URL 编码格式无效');
    throw cause;
  }
}

export function decodeUrl(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch (cause) {
    if (cause instanceof URIError) throw new ConversionError('URL 编码格式无效');
    throw cause;
  }
}
