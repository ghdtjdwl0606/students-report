
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
  const [currentStep, setCurrentStep] = useState<Step>(Step.SETUP);
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(generateFixedQuestions());
  const [studentInput, setStudentInput] = useState<StudentInput>({
    name: '',
    answers: {}
  });

  // URL에서 공유 데이터 확인 및 복원
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      try {
        // 방식 1: 초단축 배열 방식 (#s=)
        if (hash.startsWith('#s=')) {
          const compressed = hash.replace('#s=', '');
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (!decompressed) return;

          const data = JSON.parse(decompressed);
          const [name, rAns, lAns, rConf, lConf] = data;
          
          const answers: Record<string, string> = {};
          const restoredQs: Question[] = [];

          rAns.forEach((ans: string, i: number) => {
            const id = `R-${i + 1}`;
            answers[id] = ans;
            restoredQs.push({
              id,
              number: i + 1,
              section: 'Reading',
              category: rConf[i][0] || "일반",
              correctAnswer: rConf[i][1],
              points: rConf[i][2] === "" ? 1 : Number(rConf[i][2])
            });
          });

          lAns.forEach((ans: string, i: number) => {
            const id = `L-${i + 1}`;
            answers[id] = ans;
            restoredQs.push({
              id,
              number: i + 1,
              section: 'Listening',
              category: lConf[i][0] || "일반",
              correctAnswer: lConf[i][1],
              points: lConf[i][2] === "" ? 1 : Number(lConf[i][2])
            });
          });

          setQuestions(restoredQs);
          setStudentInput({ name, answers });
          setCurrentStep(Step.REPORT);
          setIsSharedMode(true);
        }
        // 기존 호환용들 (#c=, #report=)은 용량이 크므로 필요한 경우 유지하거나 생략 가능.
      } catch (e) {
        console.error("Failed to decode share link", e);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleReset = () => {
    if (isSharedMode) {
      window.location.hash = '';
      window.location.reload(); // 공유 모드 탈출 시 완전 초기화
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
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-slate-400">
              <i className="fas fa-lock text-xs"></i>
              <span className="text-xs font-bold uppercase tracking-widest">성적표 조회 전용 모드</span>
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
        {currentStep === Step.SETUP && !isSharedMode && (
          <QuestionSetup 
            questions={questions} 
            setQuestions={setQuestions} 
            onNext={() => setCurrentStep(Step.INPUT)} 
          />
        )}
        {currentStep === Step.INPUT && !isSharedMode && (
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
        {/* 공유 모드에서 부적절한 접근 시 강제 리포트 이동 */}
        {isSharedMode && currentStep !== Step.REPORT && setCurrentStep(Step.REPORT)}
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
