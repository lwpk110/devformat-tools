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
  // 结构化正文内容区：消除 thin content，覆盖长尾搜索词
  content?: ContentSection[];
}

export interface ContentSection {
  heading: string;
  // body 支持单段或多段，渲染为顺序段落
  body: string[];
}
