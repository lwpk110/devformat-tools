import { ConversionError } from './utils';

type XmlValue = string | Record<string, unknown>;

function elementToValue(element: Element): XmlValue {
  const result: Record<string, unknown> = {};
  for (const attribute of Array.from(element.attributes)) result[`@${attribute.name}`] = attribute.value;

  const childElements = Array.from(element.children);
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();

  for (const child of childElements) {
    const value = elementToValue(child);
    const existing = result[child.tagName];
    if (existing === undefined) result[child.tagName] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else result[child.tagName] = [existing, value];
  }

  if (childElements.length === 0 && Object.keys(result).length === 0) return text;
  if (text) result['#text'] = text;
  return result;
}

export function xmlToJson(input: string): string {
  if (!input.trim()) throw new ConversionError('请输入 XML');
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) throw new ConversionError('出于安全考虑，不支持 DOCTYPE 或 ENTITY');
  const document = new DOMParser().parseFromString(input, 'application/xml');
  if (document.querySelector('parsererror')) throw new ConversionError('XML 语法错误，请检查输入');
  const root = document.documentElement;
  return JSON.stringify({ [root.tagName]: elementToValue(root) }, null, 2);
}

function escapeText(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: unknown): string {
  return escapeText(value).replaceAll('"', '&quot;');
}

function valueToXml(name: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => valueToXml(name, item)).join('');
  if (typeof value !== 'object' || value === null) return `<${name}>${escapeText(value ?? '')}</${name}>`;

  const object = value as Record<string, unknown>;
  const attributes = Object.entries(object)
    .filter(([key]) => key.startsWith('@'))
    .map(([key, item]) => ` ${key.slice(1)}="${escapeAttribute(item)}"`)
    .join('');
  const text = object['#text'] === undefined ? '' : escapeText(object['#text']);
  const children = Object.entries(object)
    .filter(([key]) => !key.startsWith('@') && key !== '#text')
    .map(([key, item]) => valueToXml(key, item))
    .join('');
  return `<${name}${attributes}>${text}${children}</${name}>`;
}

export function jsonToXml(input: string): string {
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch {
    throw new ConversionError('JSON 语法错误，请检查输入');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConversionError('JSON 根值必须是 object');
  }
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object);
  if (keys.length === 1 && !keys[0].startsWith('@') && keys[0] !== '#text') return valueToXml(keys[0], object[keys[0]]);
  return valueToXml('root', object);
}
