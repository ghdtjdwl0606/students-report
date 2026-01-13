
import React, { useState } from 'react';
import { Question } from '../types';

interface Props {
  questions: Question[];
  setQuestions: (qs: Question[]) => void;
  onNext: () => void;
}

const QuestionSetup: React.FC<Props> = ({ questions, setQuestions, onNext }) => {
  const [bulkText, setBulkText] = useState<Record<string, string>>({ Reading: '', Listening: '' });
  const [showBulk, setShowBulk] = useState<Record<string, boolean>>({ Reading: false, Listening: false });

  const updateQuestion = (id: string, field: keyof Question, value: string | number) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = Array.from(document.querySelectorAll('.navigable-input')) as HTMLInputElement[];
      const index = inputs.indexOf(e.currentTarget);
      
      const nextIndex = index + 3;
      
      if (nextIndex < inputs.length) {
        inputs[nextIndex].focus();
        inputs[nextIndex].select();
      } else {
        const currentCol = index % 3;
        if (currentCol < 2) {
          const nextColFirstRow = currentCol + 1;
          if (inputs[nextColFirstRow]) {
            inputs[nextColFirstRow].focus();
            inputs[nextColFirstRow].select();
          }
        }
      }
    }
  };

  const handleBulkPaste = (section: 'Reading' | 'Listening') => {
    const lines = bulkText[section].trim().split('\n');
    const newQuestions = [...questions];
    
    lines.forEach((line, index) => {
      // Excel/Sheets typically use Tab as separator, but Comma is also common
      const columns = line.split(/\t|,/);
      const targetQuestion = newQuestions.find(q => q.section === section && q.number === index + 1);
      
      if (targetQuestion) {
        if (columns[0] !== undefined) targetQuestion.category = columns[0].trim();
        if (columns[1] !== undefined) targetQuestion.correctAnswer = columns[1].trim();
        if (columns[2] !== undefined) targetQuestion.points = parseFloat(columns[2]) || 0;
      }
    });

    setQuestions(newQuestions);
    setShowBulk({ ...showBulk, [section]: false });
    setBulkText({ ...bulkText, [section]: '' });
  };

  const renderSection = (section: 'Reading' | 'Listening', title: string, color: string) => {
    const sectionQs = questions.filter(q => q.section === section).sort((a, b) => a.number - b.number);
    
    return (
      <div className="mb-10 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r ${color} text-white`}>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <i className={`fas ${section === 'Reading' ? 'fa-book-open' : 'fa-headphones'}`}></i>
            {title}
          </h3>
          <button 
            onClick={() => setShowBulk({ ...showBulk, [section]: !showBulk[section] })}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
          >
            <i className="fas fa-paste"></i> 엑셀 붙여넣기
          </button>
        </div>

        {showBulk[section] && (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              엑셀/스프레드시트에서 [영역, 정답, 배점] 3개 열을 복사하여 아래에 붙여넣으세요.
            </label>
            <textarea 
              value={bulkText[section]}
              onChange={(e) => setBulkText({ ...bulkText, [section]: e.target.value })}
              className="w-full h-32 p-3 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 mb-3"
              placeholder="영역	정답	배점&#10;어휘	1	1.5&#10;문법	3	1.2"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowBulk({ ...showBulk, [section]: false })}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => handleBulkPaste(section)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md"
              >
                데이터 적용하기
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold w-16">번호</th>
                <th className="px-4 py-3 font-semibold">영역</th>
                <th className="px-4 py-3 font-semibold">정답</th>
                <th className="px-4 py-3 font-semibold w-28">배점</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sectionQs.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-700">{q.number}</td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      value={q.category}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => updateQuestion(q.id, 'category', e.target.value)}
                      placeholder="영역"
                      className="navigable-input w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      value={q.correctAnswer}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)}
                      placeholder="정답"
                      className="navigable-input w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      step="0.01"
                      value={q.points}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => updateQuestion(q.id, 'points', parseFloat(e.target.value) || 0)}
                      className="navigable-input w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800">1. 시험 정보 설정</h2>
        <p className="text-slate-500 mt-1">Reading과 Listening 각각 36문항의 정답과 배점을 설정하세요. 엑셀 데이터를 한꺼번에 붙여넣을 수도 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {renderSection('Reading', 'Reading Section', 'from-blue-500 to-indigo-600')}
        {renderSection('Listening', 'Listening Section', 'from-emerald-500 to-teal-600')}
      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={onNext}
          className="bg-slate-800 hover:bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center gap-3"
        >
          다음 단계: 학생 답안 입력 <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default QuestionSetup;
