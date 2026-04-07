
export interface SubjectProfile {
  name: string;
  age: string;
  sex: string;
  context: string;
}

export interface QuestionRecord {
  id: string;
  question: string;
  answer: string;
  verdict: 'TRUTH' | 'LIE' | 'PENDING';
  timestamp: number;
}

export enum SessionPhase {
  SETUP = 'SETUP',
  READY = 'READY',
  TESTING = 'TESTING',
  REPORT = 'REPORT'
}
