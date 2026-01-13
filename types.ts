
export interface Question {
  id: string;
  number: number;
  section: 'Reading' | 'Listening';
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
  section?: 'Reading' | 'Listening';
}

export interface EvaluationResult {
  studentName: string;
  totalScore: number;
  maxScore: number;
  scoreR: number;
  scoreL: number;
  actualEarnedPoints: number;
  categoryResults: CategoryResult[];
  isCorrect: Record<string, boolean>;
}
