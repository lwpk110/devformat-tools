import convertersData from './converters.json';
import type { ConverterData } from '../types/converter';

export interface ToolCatalogEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  category: string;
  categoryRank: number;
  homepageRank?: number;
  kind: 'converter' | 'session';
}

export interface ToolCategory {
  name: string;
  rank: number;
  tools: ToolCatalogEntry[];
}

const categoryRanks: Record<string, number> = {
  Data: 2,
  Encoding: 3,
  Time: 4,
  'Type Generators': 5,
};

function converterName(converter: ConverterData): string {
  const first = converter.directions[0];
  return converter.directions.length > 1
    ? `${first.from} ↔ ${first.to}`
    : `${first.from} → ${first.to}`;
}

function compareTools(left: ToolCatalogEntry, right: ToolCatalogEntry): number {
  return left.categoryRank - right.categoryRank
    || (left.homepageRank ?? Number.POSITIVE_INFINITY) - (right.homepageRank ?? Number.POSITIVE_INFINITY)
    || left.name.localeCompare(right.name);
}

function compareHomepageRank(left: ToolCatalogEntry, right: ToolCatalogEntry): number {
  return (left.homepageRank ?? Number.POSITIVE_INFINITY) - (right.homepageRank ?? Number.POSITIVE_INFINITY)
    || left.name.localeCompare(right.name);
}

const converterTools: ToolCatalogEntry[] = (convertersData as ConverterData[]).map((converter) => ({
  id: converter.slug,
  name: converterName(converter),
  description: converter.description,
  href: `/convert/${converter.slug}/`,
  category: converter.category,
  categoryRank: categoryRanks[converter.category] ?? Number.MAX_SAFE_INTEGER,
  homepageRank: converter.featuredRank === undefined ? undefined : converter.featuredRank + 2,
  kind: 'converter',
}));

const sessionTool: ToolCatalogEntry = {
  id: 'chatgpt-session-converter',
  name: 'ChatGPT Session Converter',
  description: 'Convert ChatGPT session JSON into sub2api, CPA, Cockpit, 9router, AxonHub or Codex-Manager formats locally.',
  href: '/session-converter/',
  category: 'Account & Session',
  categoryRank: 1,
  homepageRank: 1,
  kind: 'session',
};

const cardKeyTool: ToolCatalogEntry = {
  id: 'cardkey-to-sub2api',
  name: 'Card Key to Sub2API Converter',
  description: 'Convert card keys (email----pwd----token) into Sub2API import JSON, token lists or CPA format locally.',
  href: '/cardkey-converter/',
  category: 'Account & Session',
  categoryRank: 1,
  homepageRank: 2,
  kind: 'session',
};

export const toolCatalog = [sessionTool, cardKeyTool, ...converterTools].sort(compareTools);

export const popularTools = toolCatalog
  .filter((tool) => tool.homepageRank !== undefined)
  .sort(compareHomepageRank);

export const toolCategories = Object.values(
  toolCatalog.reduce<Record<string, ToolCategory>>((categories, tool) => {
    const current = categories[tool.category] ?? {
      name: tool.category,
      rank: tool.categoryRank,
      tools: [],
    };
    current.tools.push(tool);
    categories[tool.category] = current;
    return categories;
  }, {}),
).sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
