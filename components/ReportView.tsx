
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
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    calculateResults();
    return () => window.removeEventListener('resize', handleResize);
  }, [questions, studentInput]);

  const calculateResults = async () => {
    setLoading(true);
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

    const scoreR = Math.floor(140 + earnedR);
    const scoreL = Math.floor(140 + earnedL);
    const totalScore = scoreR + scoreL;
    
    const finalResult: EvaluationResult = {
      studentName: studentInput.name,
      totalScore,
      maxScore: 320,
      scoreR,
      scoreL,
      actualEarnedPoints: earnedR + earnedL,
      categoryResults,
      isCorrect
    };

    setResult(finalResult);
    
    try {
      const feedback = await getStudentFeedback(finalResult);
      setAiFeedback(feedback);
      setNeedsApiKey(false);
    } catch (err: any) {
      console.error("AI Feedback Error:", err);
      if (err.message === "API_KEY_MISSING" || err.message === "MODEL_NOT_FOUND") {
        setNeedsApiKey(true);
      } else {
        setAiFeedback("AI 피드백을 생성하는 중 일시적인 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAI = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      // 키 선택 후 즉시 재시도
      calculateResults();
    }
  };

  const copyShareLink = () => {
    try {
      const data = { questions, studentInput };
      const jsonStr = JSON.stringify(data);
      const encoded = encodeURIComponent(utf8_to_b64(jsonStr));
      const url = `${window.location.origin}${window.location.pathname}#report=${encoded}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          alert("공유 링크가 클립보드에 복사되었습니다.");
        }).catch(() => fallbackCopy(url));
      } else {
        fallbackCopy(url);
      }
    } catch (err) {
      console.error("Encoding failed:", err);
      alert("데이터 처리 중 오류가 발생했습니다.");
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert("공유 링크가 복사되었습니다.");
    } catch (err) {
      alert("링크 복사에 실패했습니다. 주소창의 URL을 직접 복사해주세요.");
    }
    document.body.removeChild(textArea);
  };

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${studentInput.name}_성적표.pdf`);
    } catch (error) {
      alert("PDF 저장 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!result) return <div className="p-20 text-center">결과를 계산하는 중...</div>;

  const readingResults = result.categoryResults.filter((r: any) => r.section === 'Reading');
  const listeningResults = result.categoryResults.filter((r: any) => r.section === 'Listening');

  const renderResponsiveChart = (data: any[], title: string, icon: string, colorClass: string) => (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm transition-all">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
        <i className={`fas ${icon} ${colorClass}`}></i> {title} 영역별 정답률
      </h3>
      <div className={`${isMobile ? 'h-[350px]' : 'h-[250px]'} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={isMobile ? 'horizontal' : 'vertical'}>
            <CartesianGrid strokeDasharray="3 3" horizontal={!isMobile} vertical={isMobile} stroke="#f1f5f9" />
            <XAxis dataKey={isMobile ? "category" : undefined} type={isMobile ? "category" : "number"} hide={!isMobile} />
            <YAxis dataKey={isMobile ? undefined : "category"} type={isMobile ? "number" : "category"} hide={isMobile} width={80} tick={{fontSize: 11, fontWeight: 600}} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
            <Bar dataKey="percentage" radius={isMobile ? [6, 6, 0, 0] : [0, 6, 6, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? '#10b981' : entry.percentage >= 50 ? '#6366f1' : '#f43f5e'} />
              ))}
              <LabelList dataKey="percentage" position={isMobile ? "top" : "right"} formatter={(val: number) => `${Math.round(val)}%`} style={{ fontSize: '10px', fontWeight: 'bold' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {!isShared && (
        <div className="flex flex-wrap justify-end gap-3 no-print px-4 md:px-0">
          <button onClick={copyShareLink} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-5 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95">
            <i className="fas fa-share-nodes text-indigo-500"></i> 링크 복사
          </button>
          <button onClick={downloadPdf} disabled={isGeneratingPdf} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50">
            {isGeneratingPdf ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-file-export"></i> PDF 저장</>}
          </button>
        </div>
      )}

      <div ref={reportRef} className="space-y-6 p-4 md:p-0">
        <div className="bg-gradient-to-br from-indigo-700 to-violet-700 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <h2 className="text-4xl font-black">{result.studentName} 학생</h2>
              <div className="mt-4 flex gap-4">
                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Reading</span>
                  <span className="text-xl font-bold">{result.scoreR} / 160</span>
                </div>
                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Listening</span>
                  <span className="text-xl font-bold">{result.scoreL} / 160</span>
                </div>
              </div>
            </div>
            <div className="bg-white text-slate-900 rounded-3xl p-8 text-center shadow-xl min-w-[200px]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Score</span>
              <div className="text-6xl font-black text-indigo-600 mt-2">{result.totalScore}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderResponsiveChart(readingResults, "Reading", "fa-book-open", "text-blue-500")}
          {renderResponsiveChart(listeningResults, "Listening", "fa-headphones", "text-emerald-500")}
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <i className="fas fa-sparkles text-amber-500"></i> AI 학습 리포트
            </h3>
            {needsApiKey && (
              <button onClick={handleConnectAI} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-200">
                <i className="fas fa-key mr-1"></i> AI 연결하기
              </button>
            )}
          </div>
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-slate-700 leading-relaxed italic min-h-[100px]">
            {loading ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-indigo-400 font-bold">AI 분석 중...</p>
              </div>
            ) : needsApiKey ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-slate-400 text-sm">AI 분석을 위해 API 키 설정이 필요합니다.</p>
                <button onClick={handleConnectAI} className="text-indigo-600 font-bold underline text-sm">지금 연결하기</button>
              </div>
            ) : (
              `"${aiFeedback}"`
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8 no-print px-4">
        <button onClick={onReset} className="w-full md:w-auto bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold shadow-xl active:scale-95">
          {isShared ? "나만의 성적표 만들기" : "다시 시작하기"}
        </button>
      </div>
    </div>
  );
};

export default ReportView;
