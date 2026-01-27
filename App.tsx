
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

  const speakingCategories = ["Picture Description", "Organization", "Language", "Fluency"];
  const speaking: Question[] = speakingCategories.map((cat, i) => ({
    id: `S-${i + 1}`,
    number: i + 1,
    section: 'Speaking',
    category: cat,
    correctAnswer: 'N/A',
    points: 4.00,
  }));

  const writingCategories = ["Personalized Connection", "Context", "Organization", "Language"];
  const writing: Question[] = writingCategories.map((cat, i) => ({
    id: `W-${i + 1}`,
    number: i + 1,
    section: 'Writing',
    category: cat,
    correctAnswer: 'N/A',
    points: 5.00,
  }));

  return [...reading, ...listening, ...speaking, ...writing];
};

const App: React.FC = () => {
  const [isSharedMode, setIsSharedMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      return hash.startsWith('#v4=') || hash.startsWith('#v5=') || hash.startsWith('#v6=');
    }
    return false;
  });
  
  const [currentStep, setCurrentStep] = useState<Step>(isSharedMode ? Step.REPORT : Step.SETUP);
  const [questions, setQuestions] = useState<Question[]>(generateFixedQuestions());
  const [studentInput, setStudentInput] = useState<StudentInput>({
    name: '',
    answers: {}
  });

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      try {
        if (hash.startsWith('#v6=')) {
          const compressed = hash.replace('#v6=', '');
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (!decompressed) return;

          const parts = decompressed.split('|');
          const [name, rAnsT, lAnsT, sAnsE, wAnsE, maskHex] = parts;
          const customConfs = parts.slice(6);
          
          const defaultQs = generateFixedQuestions();
          const restoredQs: Question[] = [];
          const answers: Record<string, string> = {};
          const mask = parseInt(maskHex, 16);

          // R/L 답안 복원 (패딩)
          const rA = rAnsT.padEnd(36, ' ');
          const lA = lAnsT.padEnd(36, ' ');
          rA.split('').forEach((c, i) => answers[`R-${i+1}`] = c === ' ' ? '' : c);
          lA.split('').forEach((c, i) => answers[`L-${i+1}`] = c === ' ' ? '' : c);

          // S/W 답안 복원 (Char Map: a=0, b=0.5...)
          const decodeScore = (char: string) => (char.charCodeAt(0) - 97) / 2;
          sAnsE.split('').forEach((c, i) => answers[`S-${i+1}`] = decodeScore(c).toString());
          wAnsE.split('').forEach((c, i) => answers[`W-${i+1}`] = decodeScore(c).toString());

          // 설정 복원 (비트마스크: bit0=R, bit1=L, bit2=S, bit3=W)
          let customIdx = 0;
          ['Reading', 'Listening', 'Speaking', 'Writing'].forEach((sn, bit) => {
            const isDefault = (mask >> bit) & 1;
            const secDefaults = defaultQs.filter(q => q.section === sn);
            if (isDefault) {
              restoredQs.push(...secDefaults);
            } else {
              const confStr = customConfs[customIdx++];
              const confArr = confStr.split('^').map(c => c.split('*'));
              secDefaults.forEach((def, i) => {
                const c = confArr[i] || [];
                restoredQs.push({ ...def, category: c[0] || def.category, correctAnswer: c[1] || def.correctAnswer, points: c[2] ? Number(c[2]) : def.points });
              });
            }
          });

          setQuestions(restoredQs);
          setStudentInput({ name, answers });
          setIsSharedMode(true);
          setCurrentStep(Step.REPORT);
        } else if (hash.startsWith('#v5=')) {
          // v5 호환
          const compressed = hash.replace('#v5=', '');
          const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
          if (!decompressed) return;
          const parts = decompressed.split('|');
          const [name, rAns, lAns, sAns, wAns, rConf, lConf, sConf, wConf] = parts;
          const defaultQs = generateFixedQuestions();
          const restoredQs: Question[] = [];
          const answers: Record<string, string> = {};
          const restore = (sec: string, ans: string, conf: string, sn: any) => {
            if (sec === 'R' || sec === 'L') ans.split('').forEach((c, i) => answers[`${sec}-${i+1}`] = c === ' ' ? "" : c);
            else ans.split('^').forEach((v, i) => answers[`${sec}-${i+1}`] = v);
            const defs = defaultQs.filter(q => q.section === sn);
            if (conf === 'D') restoredQs.push(...defs);
            else {
              const arr = conf.split('^').map(c => c.split('*'));
              defs.forEach((d, i) => { const c = arr[i] || []; restoredQs.push({ ...d, category: c[0] || d.category, correctAnswer: c[1] || d.correctAnswer, points: c[2] ? Number(c[2]) : d.points }); });
            }
          };
          restore('R', rAns, rConf, 'Reading'); restore('L', lAns, lConf, 'Listening');
          restore('S', sAns, sConf, 'Speaking'); restore('W', wAns, wConf, 'Writing');
          setQuestions(restoredQs); setStudentInput({ name, answers }); setIsSharedMode(true); setCurrentStep(Step.REPORT);
        }
      } catch (e) { console.error("Restore Error", e); }
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
            <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl border border-slate-700">
              <i className="fas fa-lock text-xs text-indigo-400"></i>
              <span className="text-[10px] font-bold uppercase tracking-widest">성적표 조회 모드 (수정 불가)</span>
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
