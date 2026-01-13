
import React, { useState, useEffect } from 'react';
import { Question, StudentInput } from './types';
import QuestionSetup from './components/QuestionSetup';
import StudentEntry from './components/StudentEntry';
import ReportView from './components/ReportView';
import LZString from 'lz-string';

enum Step {
  SETUP,
  INPUT,
  REPORT
}

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
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(Step.SETUP);
  const [questions, setQuestions] = useState<Question[]>(generateFixedQuestions());
  const [studentInput, setStudentInput] = useState<StudentInput>({
    name: '',
    answers: {}
  });

  // URL에서 공유 데이터 확인 및 복원 (즉시 감지 로직)
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      try {
        // 초압축 방식 (#v3=)
        if (hash.startsWith('#v3=')) {
          const compressed = hash.replace('#v3=', '');
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (!decompressed) return;

          const [name, rAnsStr, lAnsStr, rConfStr, lConfStr] = decompressed.split('|');
          
          const rAnswers = rAnsStr.split('^');
          const lAnswers = lAnsStr.split('^');
          const rConfigs = rConfStr.split('^').map(c => c.split('*'));
          const lConfigs = lConfStr.split('^').map(c => c.split('*'));
          
          const answers: Record<string, string> = {};
          const restoredQs: Question[] = [];

          rAnswers.forEach((ans, i) => {
            const id = `R-${i + 1}`;
            answers[id] = ans;
            restoredQs.push({
              id,
              number: i + 1,
              section: 'Reading',
              category: rConfigs[i][0] || "일반",
              correctAnswer: rConfigs[i][1],
              points: rConfigs[i][2] === "" ? 1 : Number(rConfigs[i][2])
            });
          });

          lAnswers.forEach((ans, i) => {
            const id = `L-${i + 1}`;
            answers[id] = ans;
            restoredQs.push({
              id,
              number: i + 1,
              section: 'Listening',
              category: lConfigs[i][0] || "일반",
              correctAnswer: lConfigs[i][1],
              points: lConfigs[i][2] === "" ? 1 : Number(lConfigs[i][2])
            });
          });

          setQuestions(restoredQs);
          setStudentInput({ name, answers });
          setIsSharedMode(true);
          setCurrentStep(Step.REPORT);
        } else if (hash.startsWith('#s=')) {
          // 구버전 (#s=) 대응 생략 또는 동일하게 처리
        }
      } catch (e) {
        console.error("Link Error", e);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleReset = () => {
    if (isSharedMode) {
      window.location.hash = '';
      window.location.reload(); 
    } else {
      setStudentInput({ name: '', answers: {} });
      setCurrentStep(Step.INPUT);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
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
          
          {isSharedMode ? (
            <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
              <i className="fas fa-shield-check text-xs text-indigo-400"></i>
              <span className="text-[10px] font-bold uppercase tracking-widest">성적표 조회 전용 모드</span>
            </div>
          ) : (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: Step.SETUP, label: '정보 설정', icon: 'fa-cog' },
                { id: Step.INPUT, label: '답안 입력', icon: 'fa-edit' },
                { id: Step.REPORT, label: '결과 리포트', icon: 'fa-chart-pie' }
              ].map((s) => (
                <button
                  key={s.id}
                  disabled={currentStep < s.id}
                  onClick={() => setCurrentStep(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    currentStep === s.id 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  } ${currentStep < s.id ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <i className={`fas ${s.icon}`}></i> {s.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-10">
        {!isSharedMode && currentStep === Step.SETUP && (
          <QuestionSetup 
            questions={questions} 
            setQuestions={setQuestions} 
            onNext={() => setCurrentStep(Step.INPUT)} 
          />
        )}
        {!isSharedMode && currentStep === Step.INPUT && (
          <StudentEntry 
            questions={questions} 
            studentInput={studentInput} 
            setStudentInput={setStudentInput} 
            onPrev={() => setCurrentStep(Step.SETUP)}
            onSubmit={() => setCurrentStep(Step.REPORT)}
          />
        )}
        {(isSharedMode || currentStep === Step.REPORT) && (
          <ReportView 
            questions={questions} 
            studentInput={studentInput} 
            onReset={handleReset}
            isShared={isSharedMode}
          />
        )}
      </main>

      {!isSharedMode && (
        <footer className="bg-slate-50 border-t border-slate-200 py-8 no-print">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-slate-400 text-sm">© 2024 Smart Report Card Builder. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
