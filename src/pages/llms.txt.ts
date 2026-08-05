import type { APIRoute } from 'astro';

import converters from '../data/converters.json';

export const prerender = true;

export const GET: APIRoute = () => {
  const parts: string[] = [];
  parts.push('# DevFormat.tools');
  parts.push('');
  parts.push('DevFormat.tools is a collection of free, privacy-first developer format converters.');
  parts.push('Every conversion runs entirely in the browser memory: no uploads, no accounts, no server-side processing.');
  parts.push('');
  parts.push('## Available tools');
  parts.push('');

  for (const converter of converters) {
    parts.push('### ' + converter.title);
    parts.push('');
    parts.push(converter.description);
    parts.push('');
    parts.push('Supported conversions:');
    for (const direction of converter.directions) {
      parts.push('- ' + direction.from + ' → ' + direction.to + ': ' + direction.summary);
    }
    parts.push('');
    if (converter.faq && converter.faq.length > 0) {
      parts.push('FAQ:');
      for (const item of converter.faq) {
        parts.push('Q: ' + item.q);
        parts.push('A: ' + item.a);
        parts.push('');
      }
    }
  }

  parts.push('## Privacy');
  parts.push('');
  parts.push('Input data is processed only inside the user\'s browser. No data is transmitted to, stored by, or logged on any server.');
  parts.push('');

  const body = parts.join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
