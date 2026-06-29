export type DetectedField = {
  id: string;
  label: string;
  selector: string;
  tagName: string;
  type: string;
  options?: string[];
};

export type PageContext = {
  company: string;
  role: string;
  url: string;
  platform: string;
  jdText: string;
};

export type DraftAnswer = {
  field: DetectedField;
  answer: string;
  category: string;
};
