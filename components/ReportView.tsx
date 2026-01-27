
import React, { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { EvaluationResult, Question, StudentInput } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import LZString from 'lz-string';

const CATEGORY_DESCRIPTIONS: Record<string, Record<string, string>> = {
  Reading: {
    "Author's Purpose": "글쓴이의 의도 문제. 글쓴이가 글을 통해 어떤 목적을 달성하려고 하는지 파악할 수 있는 능력을 물어봅니다.",
    "Detail": "세부사항 문제. 주요 세부 사항과 주제를 뒷받침하는 주요 정보를 이해하고, 지문의 내용과 다른 정보를 찾을 수 있는지를 물어봅니다.",
    "Inference": "추론 문제. 읽은 내용을 토대로 직접적으로 언급되지 않는 사항을 추론할 수 있는 능력을 물어봅니다.",
    "Main Idea": "주제 문제. 글이 전체적으로 무엇에 관한 것인지를 파악할 수 있는 능력을 물어봅니다.",
    "Vocabulary": "어휘 문제. 지문 속 어휘나 표현의 의미를 정확하게 파악할 수 있는지를 물어봅니다.",
    "Pronoun Referent": "지시어 문제. 지시어가 무엇을 의미하는지를 정확하게 파악할 수 있는지를 물어봅니다.",
    "Rhetorical Structure": "수사적 의도 문제. 특정 정보가 어떤 의도로 제시되었는지 파악할 수 있는지를 물어봅니다.",
    "Sentence Insertion": "문장 삽입 문제. 글의 흐름을 잘 이해하고 있는지를 물어봅니다."
  },
  Listening: {
    "Main Idea": "주제 문제. 들려주는 내용이 무엇에 관한 것인지를 파악할 수 있는지를 물어봅니다.",
    "Detail": "세부사항 문제. 주제를 뒷받침하는 중요한 세부 사항을 정확히 파악할 수 있는지를 물어봅니다.",
    "Inference": "추론 문제. 들은 내용을 토대로 직접적으로 언급되지 않은 사항을 추론할 수 있는 능력을 물어봅니다.",
    "Prosody": "화자의 어조 문제. 화자가 특정 내용을 말할 때 태도에 따라 언급되지 않은 사항을 파악할 수 있는 능력을 물어봅니다.",
    "Prediction": "예측 문제. 언급된 정보를 근거로 화자가 앞으로 할 일을 예측할 수 있는지를 물어봅니다.",
    "Speaker's Purpose": "화자의 의도 문제. 화자가 어떤 목적을 달성하려 하는지 왜 해당 내용을 말하는지를 정확하게 파악할 수 있는지를 물어봅니다.",
    "Rhetorical Device": "수사적 구조 문제. 화자가 특정 정보를 언급한 의도를 정확히 파악할 수 있는지를 물어봅니다."
  },
  Speaking: {
    "Picture Description": "주어진 요구에 따라 제시된 그림을 모두 적절하게 묘사했는지를 평가합니다.",
    "Organization": "그림에 어울리는 내용이 하나의 이야기로 자연스럽게 연결되어 있는지를 평가합니다.",
    "Language": "표현 및 어휘가 적절하게 사용되었는지를 평가합니다.",
    "Fluency": "발화하는 목소리의 유창성과 전달력을 평가합니다.",
    "Task 1": "독립형 말하기. 일상적인 주제에 대해 자신의 의견을 논리적으로 말하는 능력을 측정합니다.",
    "Task 2": "통합형(캠퍼스). 공지문이나 대화를 듣고 요약하여 말하는 능력을 측정합니다.",
    "Task 3": "통합형(강의). 학술적 강의를 듣고 주요 포인트를 설명하는 능력을 측정합니다.",
    "Task 4": "통합형(강의 요약). 강의의 세부 내용을 구조적으로 전달하는 능력을 측정합니다."
  },
  Writing: {
    "Personalized Connection": "주어진 prompt에 알맞은 opinion statement를 제시했는지 평가합니다.",
    "Context": "opinion statement를 뒷받침하는 세부 설명을 알맞게 제시했는지를 평가합니다.",
    "Organization": "글의 흐름상 자연스럽게 연결되어 있는지를 평가합니다.",
    "Language": "표현/어휘 사용의 적절성과 문법의 정확성을 평가합니다.",
    "Task 1": "문장 구성 및 문법적 정확성. 주어진 정보를 바탕으로 문장을 올바르게 구성하고 수정하는 능력을 측정합니다.",
    "Task 2": "문장 결합 및 흐름. 두 개 이상의 문장을 논리적으로 결합하여 글의 흐름을 매끄럽게 만드는 능력을 측정합니다.",
    "Task 3": "단락 구성 및 논리. 주제에 맞춰 단락을 구성하고 세부 내용을 논리적으로 전개하는 능력을 측정합니다.",
    "Task 4": "종합적 에세이 작성. 특정 주제에 대해 자신의 주장을 전개하고 적절한 예시를 들어 글을 완성하는 능력입니다."
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const sectionDesc = CATEGORY_DESCRIPTIONS[data.section] || {};
    const description = sectionDesc[data.category.trim()] || "해당 영역의 성취 성향을 분석한 데이터입니다.";

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 max-w-[280px]">
        <div className="flex justify-between items-start gap-4 mb-2">
          <p className="font-bold text-indigo-300 text-sm leading-tight">{data.category}</p>
          <p className="text-xs font-black bg-indigo-500 px-2 py-0.5 rounded-lg">{Math.round(data.percentage)}%</p>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300 font-medium">{description}</p>
      </div>
    );
  }
  return null;
};

interface Props {
  questions: Question[];
  studentInput: StudentInput;
  onReset: () => void;
  isShared?: boolean;
}

const ReportView: React.FC<Props> = ({ questions, studentInput, onReset, isShared }) => {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    calculateResults();
    return () => window.removeEventListener('resize', handleResize);
  }, [questions, studentInput]);

  const calculateResults = async () => {
    let earnedR = 0, earnedL = 0, earnedS = 0, earnedW = 0;
    let maxS = 0, maxW = 0;
    const isCorrect: Record<string, boolean> = {};
    const categoriesMap: Record<string, { total: number; correct: number; earnedPoints: number; maxPoints: number }> = {};

    questions.forEach(q => {
      const studentAns = (studentInput.answers[q.id] || '').trim();
      const fullCategory = `${q.section}-${q.category}`;
      if (!categoriesMap[fullCategory]) {
        categoriesMap[fullCategory] = { total: 0, correct: 0, earnedPoints: 0, maxPoints: 0 };
      }

      if (q.section === 'Reading' || q.section === 'Listening') {
        const correct = studentAns.toLowerCase() === q.correctAnswer.trim().toLowerCase() && studentAns !== '';
        isCorrect[q.id] = correct;
        categoriesMap[fullCategory].total += 1;
        if (correct) {
          categoriesMap[fullCategory].correct += 1;
          if (q.section === 'Reading') earnedR += q.points;
          else earnedL += q.points;
        }
      } else {
        const earned = parseFloat(studentAns) || 0;
        categoriesMap[fullCategory].earnedPoints += earned;
        categoriesMap[fullCategory].maxPoints += q.points;
        if (q.section === 'Speaking') {
          earnedS += earned;
          maxS += q.points;
        } else {
          earnedW += earned;
          maxW += q.points;
        }
      }
    });

    const categoryResults = Object.keys(categoriesMap).map(key => {
      const [section, catName] = key.split('-');
      const data = categoriesMap[key];
      const percentage = (section === 'Reading' || section === 'Listening') 
        ? (data.correct / data.total) * 100 
        : (data.earnedPoints / (data.maxPoints || 1)) * 100;

      return {
        category: catName,
        section: section as any,
        totalQuestions: data.total,
        correctCount: data.correct,
        earnedPoints: data.earnedPoints,
        maxPoints: data.maxPoints,
        percentage: percentage || 0
      };
    });

    setResult({
      studentName: studentInput.name,
      totalScoreRL: Math.floor(140 + earnedR) + Math.floor(140 + earnedL),
      totalScoreSW: earnedS + earnedW,
      maxScoreRL: 320,
      maxScoreSW: maxS + maxW,
      scoreR: Math.floor(140 + earnedR),
      scoreL: Math.floor(140 + earnedL),
      scoreS: earnedS,
      scoreW: earnedW,
      categoryResults,
      isCorrect
    });
  };

  const copyShareLink = () => {
    try {
      const getSec = (s: string) => questions.filter(q => q.section === s).sort((a,b) => a.number - b.number);
      const pack = [
        studentInput.name,
        getSec('Reading').map(q => studentInput.answers[q.id] || "").join('^'),
        getSec('Listening').map(q => studentInput.answers[q.id] || "").join('^'),
        getSec('Speaking').map(q => studentInput.answers[q.id] || "").join('^'),
        getSec('Writing').map(q => studentInput.answers[q.id] || "").join('^'),
        getSec('Reading').map(q => `${q.category}*${q.correctAnswer}*${q.points}`).join('^'),
        getSec('Listening').map(q => `${q.category}*${q.correctAnswer}*${q.points}`).join('^'),
        getSec('Speaking').map(q => `${q.category}*N/A*${q.points}`).join('^'),
        getSec('Writing').map(q => `${q.category}*N/A*${q.points}`).join('^')
      ].join('|');

      const url = `${window.location.origin}${window.location.pathname}#v4=${LZString.compressToEncodedURIComponent(pack)}`;
      navigator.clipboard.writeText(url).then(() => alert("학생용 조회 링크가 복사되었습니다."));
    } catch (e) { alert("링크 생성 실패"); }
  };

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const original = reportRef.current;
      const pdfWidth = 1200;
      const container = document.createElement('div');
      container.style.cssText = `position:absolute; left:-9999px; top:0; width:${pdfWidth}px; background:#f8fafc;`;
      document.body.appendChild(container);
      const clone = original.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${pdfWidth}px`;
      clone.style.padding = '40px';
      container.appendChild(clone);
      const canvas = await html2canvas(clone, { scale: 3, useCORS: true, backgroundColor: '#f8fafc' });
      document.body.removeChild(container);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const contentWidth = pageWidth - 20;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 10, 10, contentWidth, contentHeight);
      pdf.save(`${studentInput.name}_종합성적표.pdf`);
    } catch (e) { alert("PDF 생성 오류"); } finally { setIsGeneratingPdf(false); }
  };

  if (!result) return <div className="p-20 text-center font-bold text-slate-400">Loading...</div>;

  const chartGroups = [
    { results: result.categoryResults.filter(r => r.section === 'Reading'), title: "Reading 성취도", icon: "fa-book-open", color: "text-blue-500" },
    { results: result.categoryResults.filter(r => r.section === 'Listening'), title: "Listening 성취도", icon: "fa-headphones", color: "text-emerald-500" },
    { results: result.categoryResults.filter(r => r.section === 'Speaking'), title: "Speaking 성취도", icon: "fa-microphone", color: "text-purple-500" },
    { results: result.categoryResults.filter(r => r.section === 'Writing'), title: "Writing 성취도", icon: "fa-pen-fancy", color: "text-amber-500" }
  ].filter(g => g.results.length > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-wrap justify-end gap-3 no-print px-4 md:px-0">
        {!isShared && <button onClick={copyShareLink} className="bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95"><i className="fas fa-link text-indigo-500 mr-2"></i>조회 링크 복사</button>}
        <button onClick={downloadPdf} disabled={isGeneratingPdf} className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-md active:scale-95 disabled:opacity-50">
          {isGeneratingPdf ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-file-pdf mr-2"></i>PDF 저장</>}
        </button>
      </div>

      <div ref={reportRef} className="space-y-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl border border-slate-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <span className="bg-indigo-500/20 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 inline-block border border-indigo-500/30">Comprehensive Performance Report</span>
              <h2 className="text-4xl font-black">{result.studentName} 학생</h2>
              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                {['Reading', 'Listening', 'Speaking', 'Writing'].map(s => (
                  <div key={s} className="bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                    <span className="text-[10px] uppercase font-bold opacity-60 block">{s}</span>
                    <span className="text-lg font-bold">{(result as any)[`score${s.charAt(0)}`]}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="bg-white text-slate-900 rounded-[2rem] p-6 text-center shadow-2xl min-w-[160px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase">RL Total Score</span>
                <div className="text-5xl font-black text-indigo-600 mt-1">{result.totalScoreRL}</div>
                <div className="text-[10px] font-bold text-slate-400 border-t mt-2 pt-2">MAX {result.maxScoreRL}</div>
              </div>
              <div className="bg-indigo-600 text-white rounded-[2rem] p-6 text-center shadow-2xl min-w-[160px]">
                <span className="text-[10px] font-bold text-indigo-200 uppercase">SW Total Score</span>
                <div className="text-5xl font-black mt-1">{result.totalScoreSW}</div>
                <div className="text-[10px] font-bold text-indigo-300 border-t border-indigo-400/30 mt-2 pt-2">MAX {result.maxScoreSW}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartGroups.map((chart, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <i className={`fas ${chart.icon} ${chart.color}`}></i> {chart.title}
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.results} layout={isMobile ? "horizontal" : "vertical"}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={isMobile} horizontal={!isMobile} />
                    <XAxis type={isMobile ? "category" : "number"} dataKey={isMobile ? "category" : undefined} hide={!isMobile} />
                    <YAxis type={isMobile ? "number" : "category"} dataKey={isMobile ? undefined : "category"} hide={isMobile} width={80} tick={{ fontSize: 10, fontWeight: 700 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="percentage" barSize={18} radius={[0, 6, 6, 0]}>
                      {chart.results.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.percentage >= 80 ? '#10b981' : entry.percentage >= 50 ? '#6366f1' : '#f43f5e'} />
                      ))}
                      <LabelList dataKey="percentage" position={isMobile ? "top" : "right"} formatter={(v: any) => `${Math.round(v)}%`} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isShared && (
        <div className="flex justify-center pt-8 no-print px-4">
          <button onClick={onReset} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform">처음으로 돌아가기</button>
        </div>
      )}
    </div>
  );
};

export default ReportView;
