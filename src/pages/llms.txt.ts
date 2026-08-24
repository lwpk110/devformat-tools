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
  parts.push('## Suggested starting points');
  parts.push('');
  parts.push('- https://abc123456.uk/');
  parts.push('- https://abc123456.uk/cardkey-converter/');
  parts.push('- https://abc123456.uk/session-converter/');
  parts.push('- https://abc123456.uk/convert/json-csv/');
  parts.push('- https://abc123456.uk/convert/base64/');
  parts.push('- https://abc123456.uk/guides/json-vs-csv/');
  parts.push('- https://abc123456.uk/guides/base64-vs-encryption/');
  parts.push('- https://abc123456.uk/guides/seo-growth-and-monetization/');
  parts.push('');
  parts.push('## Available tools');
  parts.push('');
  parts.push('### Card Key to Sub2API Converter');
  parts.push('');
  parts.push('Convert raw card keys (email----password----token) into Sub2API import JSON, token lists, and CPA format locally in browser memory.');
  parts.push('');
  parts.push('Supported platforms: Grok (xAI), Claude (Anthropic), OpenAI / ChatGPT, Gemini (Google)');
  parts.push('');
  parts.push('### ChatGPT Session Converter');
  parts.push('');
  parts.push('Convert ChatGPT session JSON into sub2api, CPA, Cockpit, 9router, AxonHub and Codex-Manager formats with JWT parsing and synthetic token generation.');
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

  parts.push('## Editorial note');
  parts.push('');
  parts.push('The best tool pages answer the task immediately, then explain edge cases, failure modes, and when not to use the tool. This site follows that pattern so the page is useful to people and easy to cite by LLMs.');
  parts.push('');

  const body = parts.join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
