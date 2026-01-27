
export interface Question {
  id: string;
  number: number;
  section: 'Reading' | 'Listening' | 'Speaking' | 'Writing';
  category: string;
  correctAnswer: string;
  points: number;
}

export interface StudentInput {
  name: string;
  answers: Record<string, string>;
}

export interface CategoryResult {
  category: string;
  totalQuestions: number;
  correctCount: number;
  percentage: number;
  section?: 'Reading' | 'Listening' | 'Speaking' | 'Writing';
  earnedPoints?: number;
  maxPoints?: number;
}

export interface EvaluationResult {
  studentName: string;
  totalScoreRL: number;
  totalScoreSW: number;
  maxScoreRL: number;
  maxScoreSW: number;
  scoreR: number;
  scoreL: number;
  scoreS: number;
  scoreW: number;
  categoryResults: CategoryResult[];
  isCorrect: Record<string, boolean>;
}
