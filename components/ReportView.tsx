
import React, { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { EvaluationResult, Question, StudentInput } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import LZString from 'lz-string';

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
  };

  const copyShareLink = () => {
    try {
      const rQs = questions.filter(q => q.section === 'Reading').sort((a,b) => a.number - b.number);
      const lQs = questions.filter(q => q.section === 'Listening').sort((a,b) => a.number - b.number);

      const pack = [
        studentInput.name,
        rQs.map(q => studentInput.answers[q.id] || "").join('^'),
        lQs.map(q => studentInput.answers[q.id] || "").join('^'),
        rQs.map(q => `${q.category === "일반" ? "" : q.category}*${q.correctAnswer}*${q.points === 1 ? "" : q.points}`).join('^'),
        lQs.map(q => `${q.category === "일반" ? "" : q.category}*${q.correctAnswer}*${q.points === 1 ? "" : q.points}`).join('^')
      ].join('|');

      const compressed = LZString.compressToEncodedURIComponent(pack);
      const url = `${window.location.origin}${window.location.pathname}#v3=${compressed}`;
      
      const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          alert("단축 링크가 복사되었습니다.");
        } catch (err) {
          alert("링크 복사 실패");
        }
        document.body.removeChild(textArea);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
          .then(() => alert("학생용 단축 링크가 복사되었습니다. (조회 전용)"))
          .catch(() => fallbackCopy(url));
      } else {
        fallbackCopy(url);
      }
    } catch (err) {
      alert("링크 생성 실패");
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
      alert("PDF 생성 오류");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!result) return <div className="p-20 text-center font-bold text-slate-400">데이터를 불러오는 중입니다...</div>;

  const readingResults = result.categoryResults.filter((r: any) => r.section === 'Reading');
  const listeningResults = result.categoryResults.filter((r: any) => r.section === 'Listening');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Top Actions: Students can ONLY download PDF */}
      <div className="flex flex-wrap justify-end gap-3 no-print px-4 md:px-0">
        {!isShared && (
          <button onClick={copyShareLink} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-5 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95">
            <i className="fas fa-link text-indigo-500"></i> 조회용 링크 복사
          </button>
        )}
        <button onClick={downloadPdf} disabled={isGeneratingPdf} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50">
          {isGeneratingPdf ? <i className="fas fa-spinner animate-spin"></i> : <><i className="fas fa-file-pdf"></i> PDF 저장하기</>}
        </button>
      </div>

      <div ref={reportRef} className="space-y-6 p-4 md:p-0">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden border border-slate-700">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <span className="inline-block bg-indigo-500/20 backdrop-blur-md px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-indigo-500/30">Official Student Report</span>
              <h2 className="text-4xl font-black">{result.studentName} 학생</h2>
              <div className="mt-4 flex gap-4">
                <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Reading</span>
                  <span className="text-xl font-bold">{result.scoreR}</span>
                </div>
                <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10">
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
      </div>

      {/* Footer Reset Section: Hide completely if isShared is true */}
      {!isShared && (
        <div className="flex justify-center pt-8 no-print px-4">
          <button onClick={onReset} className="w-full md:w-auto bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform">
            처음으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportView;
