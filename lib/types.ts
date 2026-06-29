export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type JobStatus =
  | "discovered"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer";

export type ContactStatus =
  | "new"
  | "drafted"
  | "sent"
  | "follow_up_due"
  | "responded"
  | "closed";

export type Job = {
  id: string;
  title: string;
  company: string;
  url: string;
  platform: string;
  jdText: string;
  fitScore: number | null;
  status: JobStatus;
  answers: Record<string, string>;
  appliedAt: string | null;
  notes: string;
  createdAt: string;
};

export type Contact = {
  id: string;
  name: string;
  title: string;
  company: string;
  platform: string;
  profileUrl: string;
  status: ContactStatus;
  messageHistory: OutreachMessage[];
  followUpDate: string | null;
  notes: string;
  createdAt: string;
};

export type OutreachMessage = {
  channel: "linkedin_note" | "linkedin_dm" | "twitter_dm" | "email";
  body: string;
  createdAt: string;
};

export type OutreachTemplate = {
  label: string;
  goal: string;
  maxChars: number | null;
  structure: string[];
  examples: string[];
};

export type OutreachTemplateConfig = {
  globalRules: string[];
  proofPoints: string[];
  channels: Record<OutreachMessage["channel"], OutreachTemplate>;
};

export type CandidateProfile = {
  name: string;
  contact: {
    email: string;
    phone: string;
    website: string;
    linkedin: string;
    github: string;
  };
  headline: string;
  summary: string;
  skills: string[];
  experience: {
    company: string;
    title: string;
    location: string;
    start: string;
    end: string;
    highlights: string[];
  }[];
  projects: string[];
  preferredRoles: string[];
  locationPreferences: string[];
  salaryExpectation: string;
  noticePeriod: string;
  narratives: {
    whyLooking: string;
    careerGoal: string;
    whyLeftPreviousCompany: string;
  };
  outreachVoice: {
    traits: string[];
    rules: string[];
  };
  resumes: Record<string, string>;
};

export type AnswerRequest = {
  question: string;
  company: string;
  role: string;
  jdText?: string;
  jobUrl?: string;
};

export type AnswerResult = {
  category: string;
  answer: string;
  matchedKeywords: string[];
  cached: boolean;
};
