
import React, { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { EvaluationResult, Question, StudentInput } from '../types';
import { getStudentFeedback } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  questions: Question[];
  studentInput: StudentInput;
  onReset: () => void;
  isShared?: boolean;
}

const utf8_to_b64 = (str: string) => window.btoa(unescape(encodeURIComponent(str)));

const ReportView: React.FC<Props> = ({ questions, studentInput, onReset, isShared }) => {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    calculateResults();
    return () => window.removeEventListener('resize', handleResize);
  }, [questions, studentInput]);

  const calculateResults = async () => {
    let earnedR = 0;
    let earnedL = 0;
    const isCorrect: Record<string, boolean> = {};
    const categoriesMap: Record<string, { total: number; correct: number }> = {};

    questions.forEach(q => {
      const studentAns = (studentInput.answers[q.id] || '').trim().toLowerCase();
      const correctAns = (q.correctAnswer || '').trim().toLowerCase();
      const correct = studentAns !== '' && studentAns === correctAns;
      
      isCorrect[q.id] = correct;
      if (correct) {
        if (q.section === 'Reading') earnedR += q.points;
        else earnedL += q.points;
      }

      const fullCategory = `${q.section}-${q.category}`;
      if (!categoriesMap[fullCategory]) {
        categoriesMap[fullCategory] = { total: 0, correct: 0 };
      }
      categoriesMap[fullCategory].total += 1;
      if (correct) categoriesMap[fullCategory].correct += 1;
    });

    const categoryResults = Object.keys(categoriesMap).map(key => {
      const [section, catName] = key.split('-');
      return {
        category: catName,
        section: section as 'Reading' | 'Listening',
        totalQuestions: categoriesMap[key].total,
        correctCount: categoriesMap[key].correct,
        percentage: (categoriesMap[key].correct / categoriesMap[key].total) * 100
      };
    });

    const finalResult: EvaluationResult = {
      studentName: studentInput.name,
      totalScore: Math.floor(140 + earnedR) + Math.floor(140 + earnedL),
      maxScore: 320,
      scoreR: Math.floor(140 + earnedR),
      scoreL: Math.floor(140 + earnedL),
      actualEarnedPoints: earnedR + earnedL,
      categoryResults,
      isCorrect
    };

    setResult(finalResult);
    
    // 성적 계산 후 즉시 AI 분석 시도
    requestAiFeedback(finalResult);
  };

  const requestAiFeedback = async (data: EvaluationResult) => {
    setLoadingAi(true);
    setErrorMessage("");
    setNeedsApiKey(false);

    try {
      // 1. AI Studio 환경에서 키가 이미 선택되었는지 확인
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey && !process.env.API_KEY) {
          setNeedsApiKey(true);
          setLoadingAi(false);
          return;
        }
      }

      // 2. 피드백 요청
      const feedback = await getStudentFeedback(data);
      setAiFeedback(feedback);
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      if (err.message === "API_KEY_MISSING" || err.message === "MODEL_NOT_FOUND" || err.message === "INVALID_API_KEY") {
        setNeedsApiKey(true);
      } else {
        setErrorMessage("분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setLoadingAi(false);
    }
  };

  const handleConnectAI = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        // 키 선택 창이 닫힌 후 (성공 가정) 재시도
        if (result) requestAiFeedback(result);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  const copyShareLink = () => {
    const data = { questions, studentInput };
    const encoded = encodeURIComponent(utf8_to_b64(JSON.stringify(data)));
    const url = `${window.location.origin}${window.location.pathname}#report=${encoded}`;
    
    const fallbackCopy = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert("링크가 복사되었습니다.");
      } catch (err) {
        alert("링크 복사에 실패했습니다. URL을 직접 복사해 주세요.");
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alert("성적표 링크가 클립보드에 복사되었습니다."))
        .catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  };

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${studentInput.name}_성적분석표.pdf`);
    } catch (e) {
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!result) return <div className="p-20 text-center font-bold text-slate-400">성적 데이터를 처리 중입니다...</div>;

  const readingResults = result.categoryResults.filter((r: any) => r.section === 'Reading');
  const listeningResults = result.categoryResults.filter((r: any) => r.section === 'Listening');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Action Buttons */}
      {!isShared && (
        <div className="flex flex-wrap justify-end gap-3 no-print px-4 md:px-0">
          <button onClick={copyShareLink} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-5 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95">
            <i className="fas fa-link text-indigo-500"></i> 학생용 링크 복사
          </button>
          <button onClick={downloadPdf} disabled={isGeneratingPdf} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50">
            {isGeneratingPdf ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-file-pdf"></i> PDF 저장</>}
          </button>
        </div>
      )}

      <div ref={reportRef} className="space-y-6 p-4 md:p-0">
        {/* Header Summary */}
        <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <span className="inline-block bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">Official Analysis</span>
              <h2 className="text-4xl font-black">{result.studentName} 학생</h2>
              <div className="mt-4 flex gap-4">
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Reading</span>
                  <span className="text-xl font-bold">{result.scoreR}</span>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Listening</span>
                  <span className="text-xl font-bold">{result.scoreL}</span>
                </div>
              </div>
            </div>
            <div className="bg-white text-slate-900 rounded-[2rem] p-8 text-center shadow-2xl min-w-[220px]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Score</span>
              <div className="text-6xl font-black text-indigo-600 mt-2 tracking-tighter">{result.totalScore}</div>
              <div className="mt-2 text-slate-400 text-xs font-bold border-t border-slate-100 pt-2">MAX 320</div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[ 
            { data: readingResults, title: "Reading", icon: "fa-book-open", color: "text-blue-500" },
            { data: listeningResults, title: "Listening", icon: "fa-headphones", color: "text-emerald-500" }
          ].map((chart, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <i className={`fas ${chart.icon} ${chart.color}`}></i> {chart.title} 영역 성취도
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.data} layout={isMobile ? "horizontal" : "vertical"} margin={{ left: isMobile ? 0 : 20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={!isMobile} vertical={isMobile} />
                    <XAxis type={isMobile ? "category" : "number"} dataKey={isMobile ? "category" : undefined} hide={!isMobile} />
                    <YAxis type={isMobile ? "number" : "category"} dataKey={isMobile ? undefined : "category"} hide={isMobile} width={80} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="percentage" radius={isMobile ? [6, 6, 0, 0] : [0, 6, 6, 0]} barSize={20}>
                      {chart.data.map((entry: any, i: number) => (
                        <Cell key={`cell-${i}`} fill={entry.percentage >= 80 ? '#10b981' : entry.percentage >= 50 ? '#6366f1' : '#f43f5e'} />
                      ))}
                      <LabelList dataKey="percentage" position={isMobile ? "top" : "right"} formatter={(v: number) => `${Math.round(v)}%`} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* AI Analysis Card */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <i className="fas fa-brain text-8xl text-indigo-900"></i>
          </div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
                <i className="fas fa-sparkles text-sm"></i>
              </span>
              AI 학습 인사이트
            </h3>
            {!loadingAi && (needsApiKey || errorMessage) && (
              <button onClick={handleConnectAI} className="text-xs bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors">
                <i className="fas fa-key mr-2"></i> 다시 연결하기
              </button>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-100 text-slate-700 leading-relaxed min-h-[140px] flex items-center justify-center relative z-10">
            {loadingAi ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce"></div>
                </div>
                <p className="text-sm text-indigo-500 font-bold tracking-tight">성적 데이터를 정밀 분석하고 있습니다...</p>
              </div>
            ) : needsApiKey ? (
              <div className="text-center space-y-4 max-w-sm">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <i className="fas fa-lock text-slate-300"></i>
                </div>
                <div>
                  <p className="text-slate-500 font-medium mb-1">AI 분석 기능이 비활성화되어 있습니다.</p>
                  <button onClick={handleConnectAI} className="text-indigo-600 font-black underline decoration-2 underline-offset-4 hover:text-indigo-800">지금 연결하여 피드백 받기</button>
                </div>
                <p className="text-[10px] text-slate-400">사용 중인 AI Studio의 유료 프로젝트 키가 필요할 수 있습니다.</p>
              </div>
            ) : errorMessage ? (
              <div className="text-center py-6">
                <i className="fas fa-exclamation-circle text-rose-400 text-2xl mb-2"></i>
                <p className="text-slate-500 text-sm font-medium">{errorMessage}</p>
                <button onClick={() => requestAiFeedback(result)} className="mt-4 text-xs font-bold text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50">재시도</button>
              </div>
            ) : (
              <p className="text-lg md:text-xl font-medium text-slate-600 leading-relaxed italic text-center md:text-left">
                <i className="fas fa-quote-left text-slate-200 text-2xl mr-4 align-top"></i>
                {aiFeedback || "분석 결과가 여기에 표시됩니다."}
                <i className="fas fa-quote-right text-slate-200 text-2xl ml-4 align-bottom"></i>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8 no-print px-4">
        <button onClick={onReset} className="w-full md:w-auto bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform">
          {isShared ? "나의 성적표 직접 만들기" : "처음으로 돌아가기"}
        </button>
      </div>
    </div>
  );
};

export default ReportView;
