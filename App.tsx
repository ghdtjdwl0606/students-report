
import React, { useState, useEffect } from 'react';
import { Question, StudentInput } from './types';
import QuestionSetup from './components/QuestionSetup';
import StudentEntry from './components/StudentEntry';
import ReportView from './components/ReportView';

enum Step {
  SETUP,
  INPUT,
  REPORT
}

// 유니코드 안전한 Base64 디코딩 함수
const b64_to_utf8 = (str: string) => decodeURIComponent(escape(window.atob(str)));

const generateFixedQuestions = (): Question[] => {
  const reading: Question[] = Array.from({ length: 36 }, (_, i) => ({
    id: `R-${i + 1}`,
    number: i + 1,
    section: 'Reading',
    category: '일반',
    correctAnswer: '',
    points: 1.00,
  }));

  const listening: Question[] = Array.from({ length: 36 }, (_, i) => ({
    id: `L-${i + 1}`,
    number: i + 1,
    section: 'Listening',
    category: '일반',
    correctAnswer: '',
    points: 1.00,
  }));

  return [...reading, ...listening];
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.SETUP);
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(generateFixedQuestions());
  const [studentInput, setStudentInput] = useState<StudentInput>({
    name: '',
    answers: {}
  });

  // URL에서 공유 데이터 확인
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#report=')) {
        try {
          const encodedData = hash.replace('#report=', '');
          const decodedStr = b64_to_utf8(decodeURIComponent(encodedData));
          const decodedData = JSON.parse(decodedStr);
          
          if (decodedData.questions && decodedData.studentInput) {
            setQuestions(decodedData.questions);
            setStudentInput(decodedData.studentInput);
            setCurrentStep(Step.REPORT);
            setIsSharedMode(true);
          }
        } catch (e) {
          console.error("Failed to decode share link", e);
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleReset = () => {
    if (isSharedMode) {
      window.location.hash = '';
      setIsSharedMode(false);
      setCurrentStep(Step.SETUP);
      // 데이터 초기화
      setQuestions(generateFixedQuestions());
      setStudentInput({ name: '', answers: {} });
    } else {
      setStudentInput({ name: '', answers: {} });
      setCurrentStep(Step.INPUT);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fas fa-graduation-cap text-lg"></i>
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">스마트 성적표</h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Report Builder Pro</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: Step.SETUP, label: '정보 설정', icon: 'fa-cog' },
              { id: Step.INPUT, label: '답안 입력', icon: 'fa-edit' },
              { id: Step.REPORT, label: '결과 리포트', icon: 'fa-chart-pie' }
            ].map((s) => (
              <button
                key={s.id}
                disabled={currentStep < s.id && !isSharedMode}
                onClick={() => !isSharedMode && setCurrentStep(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  currentStep === s.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                } ${currentStep < s.id && !isSharedMode ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <i className={`fas ${s.icon}`}></i> {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-10">
        {currentStep === Step.SETUP && (
          <QuestionSetup 
            questions={questions} 
            setQuestions={setQuestions} 
            onNext={() => setCurrentStep(Step.INPUT)} 
          />
        )}
        {currentStep === Step.INPUT && (
          <StudentEntry 
            questions={questions} 
            studentInput={studentInput} 
            setStudentInput={setStudentInput} 
            onPrev={() => setCurrentStep(Step.SETUP)}
            onSubmit={() => setCurrentStep(Step.REPORT)}
          />
        )}
        {currentStep === Step.REPORT && (
          <ReportView 
            questions={questions} 
            studentInput={studentInput} 
            onReset={handleReset}
            isShared={isSharedMode}
          />
        )}
      </main>

      <footer className="bg-slate-50 border-t border-slate-200 py-8 no-print">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-slate-400 text-sm">© 2024 Smart Report Card Builder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
