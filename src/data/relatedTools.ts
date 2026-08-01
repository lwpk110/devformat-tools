import type { ConverterData } from '../types/converter';

function formats(converter: ConverterData): Set<string> {
  return new Set(converter.directions.flatMap(({ from, to }) => [from, to]));
}

export function selectRelatedTools(current: ConverterData, candidates: ConverterData[]): ConverterData[] {
  const currentFormats = formats(current);

  return candidates
    .filter(({ slug }) => slug !== current.slug)
    .map((candidate) => {
      const sharesFormat = [...formats(candidate)].some((format) => currentFormats.has(format));
      const score = (candidate.category === current.category ? 4 : 0) + (sharesFormat ? 2 : 0);

      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score || left.candidate.slug.localeCompare(right.candidate.slug))
    .slice(0, 4)
    .map(({ candidate }) => candidate);
}
