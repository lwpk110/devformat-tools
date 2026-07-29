export interface FAQItem {
  q: string;
  a: string;
}

export interface ConverterDirection {
  id: string;
  from: string;
  to: string;
  sampleInput: string;
  sampleOutput: string;
  downloadExtension: string;
  summary: string;
}

export interface ConverterData {
  slug: string;
  category: string;
  title: string;
  description: string;
  featuredRank?: number;
  directions: ConverterDirection[];
  faq: FAQItem[];
}
