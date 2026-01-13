
import React from 'react';
import { Question, StudentInput } from '../types';

interface Props {
  questions: Question[];
  studentInput: StudentInput;
  setStudentInput: (input: StudentInput) => void;
  onPrev: () => void;
  onSubmit: () => void;
}

const StudentEntry: React.FC<Props> = ({ questions, studentInput, setStudentInput, onPrev, onSubmit }) => {
  const handleAnswerChange = (qId: string, val: string) => {
    setStudentInput({
      ...studentInput,
      answers: { ...studentInput.answers, [qId]: val }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('.navigable-input')) as HTMLInputElement[];
      const index = inputs.indexOf(e.currentTarget);
      if (index > -1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
        inputs[index + 1].select();
      } else if (index === inputs.length - 1) {
        // Last input, maybe trigger submit or just blur
        e.currentTarget.blur();
      }
    }
  };

  const renderSectionInputs = (section: 'Reading' | 'Listening', title: string, icon: string) => {
    const sectionQs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
    if (sectionQs.length === 0) return null;

    return (
      <div className="mb-10">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i className={`fas ${icon} text-indigo-500`}></i> {title}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sectionQs.map((q) => (
            <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-400">#{q.number}</span>
                <span className="text-[10px] text-slate-400 truncate max-w-[60px]">{q.category}</span>
              </div>
              <input 
                type="text" 
                value={studentInput.answers[q.id] || ''}
                onKeyDown={handleKeyDown}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                placeholder="답"
                className="navigable-input w-full text-center font-semibold text-slate-700 outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 max-w-5xl mx-auto">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-800">2. 학생 답안 입력</h2>
        <p className="text-slate-500 mt-1">학생 정보와 마킹한 답안을 정확히 입력해주세요.</p>
      </div>

      <div className="mb-12 p-8 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <label className="block text-indigo-900 font-bold mb-2 text-sm uppercase tracking-wider">학생 이름</label>
          <input 
            type="text" 
            value={studentInput.name}
            onKeyDown={handleKeyDown}
            onChange={(e) => setStudentInput({ ...studentInput, name: e.target.value })}
            placeholder="이름을 입력하세요"
            className="navigable-input w-full border border-indigo-200 rounded-xl px-5 py-3 text-lg font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white"
          />
        </div>
        <div className="text-slate-500 text-sm md:w-1/3">
          <i className="fas fa-info-circle mr-1"></i> Enter 키를 누르면 다음 문항으로 빠르게 이동합니다.
        </div>
      </div>

      {renderSectionInputs('Reading', 'Reading 파트 답안', 'fa-book-open')}
      {renderSectionInputs('Listening', 'Listening 파트 답안', 'fa-headphones')}

      <div className="mt-12 flex justify-between items-center pt-8 border-t border-slate-100">
        <button 
          onClick={onPrev}
          className="text-slate-400 hover:text-slate-800 font-bold flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-arrow-left"></i> 설정으로 돌아가기
        </button>
        <button 
          onClick={onSubmit}
          disabled={!studentInput.name}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-200 flex items-center gap-3"
        >
          채점 결과 확인 <i className="fas fa-check"></i>
        </button>
      </div>
    </div>
  );
};

export default StudentEntry;
