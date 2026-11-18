import { decode as decodeCp1251 } from 'windows-1251';

/**
 * Forum pages are windows-1251, not UTF-8. Decode by the charset the response declares
 * (header first, then <meta>), defaulting to windows-1251 for 4PDA.
 */
export function charsetOf(contentType: string | null | undefined, head?: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  if (head) {
    // The <meta> tag is ASCII, so a latin-1 view of the first bytes is enough to find it.
    let ascii = '';
    for (let i = 0; i < Math.min(head.length, 2048); i++) ascii += String.fromCharCode(head[i]);
    const fromMeta = ascii.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
    if (fromMeta) return fromMeta.toLowerCase();
  }
  return 'windows-1251';
}

export function decodeHtml(bytes: Uint8Array, contentType?: string | null): string {
  const charset = charsetOf(contentType, bytes);
  if (charset === 'utf-8' || charset === 'utf8') return new TextDecoder('utf-8').decode(bytes);
  if (charset === 'windows-1251' || charset === 'cp1251') return decodeCp1251(bytes);
  // Unknown charsets: windows-1251 is right for every 4PDA page seen so far.
  return decodeCp1251(bytes);
}
