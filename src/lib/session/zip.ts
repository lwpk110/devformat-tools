// 纯函数 ZIP 构建器：多账号 CPA 批量下载时打包为 .zip
// 无外部依赖，使用 CRC32 + 手写 ZIP 结构

function crc32(bytes: Uint8Array): number {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let current = index;
      for (let shift = 0; shift < 8; shift += 1) {
        current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
      }
      table[index] = current;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
crc32.table = null as unknown as Uint32Array;

function littleEndian32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function littleEndian16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function getZipDosDateTime(date: Date = new Date()): { dosTime: number; dosDate: number } {
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export interface ZipEntry {
  name: string;
  text: string;
  date?: Date;
}

export function buildZipBlob(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBytes = encoder.encode(entry.name);
    const fileData = encoder.encode(entry.text);
    const checksum = crc32(fileData);
    const { dosTime, dosDate } = getZipDosDateTime(entry.date);

    const localHeader = concatBytes([
      littleEndian32(0x04034b50),
      littleEndian16(20),
      littleEndian16(0),
      littleEndian16(0),
      littleEndian16(dosTime),
      littleEndian16(dosDate),
      littleEndian32(checksum),
      littleEndian32(fileData.length),
      littleEndian32(fileData.length),
      littleEndian16(fileNameBytes.length),
      littleEndian16(0),
      fileNameBytes,
    ]);
    localParts.push(localHeader, fileData);

    const centralHeader = concatBytes([
      littleEndian32(0x02014b50),
      littleEndian16(20),
      littleEndian16(20),
      littleEndian16(0),
      littleEndian16(0),
      littleEndian16(dosTime),
      littleEndian16(dosDate),
      littleEndian32(checksum),
      littleEndian32(fileData.length),
      littleEndian32(fileData.length),
      littleEndian16(fileNameBytes.length),
      littleEndian16(0),
      littleEndian16(0),
      littleEndian16(0),
      littleEndian16(0),
      littleEndian32(0),
      littleEndian32(offset),
      fileNameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + fileData.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const centralSize = centralDirectory.length;
  const endRecord = concatBytes([
    littleEndian32(0x06054b50),
    littleEndian16(0),
    littleEndian16(0),
    littleEndian16(entries.length),
    littleEndian16(entries.length),
    littleEndian32(centralSize),
    littleEndian32(offset),
    littleEndian16(0),
  ]);

  // 合并为单个 ArrayBuffer 以满足 BlobPart 类型约束（TS 5.7 严格模式）
  const allBytes = concatBytes([...localParts, centralDirectory, endRecord]);
  const buffer = new ArrayBuffer(allBytes.length);
  new Uint8Array(buffer).set(allBytes);
  return new Blob([buffer], { type: 'application/zip' });
}
