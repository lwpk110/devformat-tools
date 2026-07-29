import { jsonToGo } from './jsonToGo';
import { jsonToPython } from './jsonToPython';
import { jsonToRust } from './jsonToRust';
import { jsonToTypeScript } from './jsonToTs';
import { jsonToYaml } from './jsonToYaml';
import { dateTimeToTimestamp, timestampToDateTime } from './timestamp';
import { ConversionError } from './utils';
import { jsonToXml, xmlToJson } from './xml';
import { yamlToJson } from './yaml';

export type Converter = (input: string) => string;

export const supportedConverters: Readonly<Record<string, Converter>> = {
  'json-to-csv': jsonToCsv,
  'csv-to-json': csvToJson,
  'base64-encode': encodeBase64,
  'base64-decode': decodeBase64,
  'json-to-yaml': jsonToYaml,
  'yaml-to-json': yamlToJson,
  'json-to-xml': jsonToXml,
  'xml-to-json': xmlToJson,
  'timestamp-to-datetime': timestampToDateTime,
  'datetime-to-timestamp': dateTimeToTimestamp,
  'json-to-go-struct': jsonToGo,
  'json-to-typescript': jsonToTypeScript,
  'json-to-python-dataclass': jsonToPython,
  'json-to-rust-struct': jsonToRust,
};

export function convert(slug: string, input: string): string {
  const converter = supportedConverters[slug];
  if (!converter) throw new ConversionError(`不支持的转换器: ${slug}`);
  return converter(input);
}

export { ConversionError } from './utils';
import { decodeBase64, encodeBase64 } from './base64';
import { csvToJson, jsonToCsv } from './csv';
