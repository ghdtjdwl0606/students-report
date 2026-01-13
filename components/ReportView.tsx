
import React, { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

const ReportView: React.FC<Props> = ({ questions, studentInput, onReset, isShared }) => {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>("AI 분석 중...");
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    calculateResults();
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
    const maxScore = 320;

    const finalResult: EvaluationResult = {
      studentName: studentInput.name,
      totalScore,
      maxScore,
      scoreR,
      scoreL,
      actualEarnedPoints: earnedR + earnedL,
      categoryResults,
      isCorrect
    };

    setResult(finalResult);
    
    // AI Feedback
    const feedback = await getStudentFeedback(finalResult);
    setAiFeedback(feedback);
    setLoading(false);
  };

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    
    // Slight delay to ensure charts are fully rendered
    await new Promise(r => setTimeout(r, 500));

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${studentInput.name}_성적표.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const copyShareLink = () => {
    const data = { questions, studentInput };
    const encoded = encodeURIComponent(btoa(JSON.stringify(data)));
    const url = `${window.location.origin}${window.location.pathname}#report=${encoded}`;
    
    navigator.clipboard.writeText(url).then(() => {
      alert("학생용 개별 성적표 링크가 클립보드에 복사되었습니다.");
    });
  };

  if (!result) return <div className="p-20 text-center">결과를 계산하는 중...</div>;

  const readingResults = result.categoryResults.filter((r: any) => r.section === 'Reading');
  const listeningResults = result.categoryResults.filter((r: any) => r.section === 'Listening');

  const renderHorizontalChart = (data: any[], title: string, icon: string, colorClass: string) => (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <i className={`fas ${icon} ${colorClass}`}></i> {title} 영역별 정답률
        </h3>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
              type="category" 
              dataKey="category" 
              axisLine={false} 
              tickLine={false} 
              width={80}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} 
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
              formatter={(val: number) => [`${val.toFixed(1)}%`, '정답률']}
            />
            <Bar dataKey="percentage" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? '#10b981' : entry.percentage >= 50 ? '#6366f1' : '#f43f5e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Action Buttons */}
      {!isShared && (
        <div className="flex flex-wrap justify-end gap-3 no-print">
          <button 
            onClick={copyShareLink}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
          >
            <i className="fas fa-link text-indigo-500"></i> 학생용 링크 복사
          </button>
          <button 
            onClick={downloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl font-bold transition-all shadow-md disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <><i className="fas fa-spinner animate-spin"></i> 생성 중...</>
            ) : (
              <><i className="fas fa-file-pdf"></i> PDF 다운로드</>
            )}
          </button>
        </div>
      )}

      <div ref={reportRef} className="space-y-6 p-4 md:p-0">
        {/* Summary Header */}
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                Student Score Report
              </div>
              <h2 className="text-4xl font-black">{result.studentName} 학생</h2>
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Reading</span>
                  <span className="text-xl font-bold">{result.scoreR} / 160</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Listening</span>
                  <span className="text-xl font-bold">{result.scoreL} / 160</span>
                </div>
              </div>
            </div>
            <div className="bg-white text-slate-900 rounded-3xl p-8 text-center shadow-xl border border-white/20 min-w-[240px]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Final Total Score</span>
              <div className="text-6xl font-black text-indigo-600 mt-2">
                {result.totalScore}
              </div>
              <div className="mt-2 text-slate-400 font-bold border-t border-slate-100 pt-2">
                MAX: {result.maxScore}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderHorizontalChart(readingResults, "Reading", "fa-book-open", "text-blue-500")}
            {renderHorizontalChart(listeningResults, "Listening", "fa-headphones", "text-emerald-500")}
          </div>

          {/* AI Insight Card */}
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <i className="fas fa-brain text-8xl"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
              <i className="fas fa-sparkles text-amber-500"></i> AI 피드백
            </h3>
            <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-slate-100 text-slate-700 leading-relaxed italic relative z-10 text-sm overflow-y-auto min-h-[120px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="animate-pulse text-indigo-400 font-medium">분석 중...</div>
                </div>
              ) : (
                `"${aiFeedback}"`
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8 no-print">
        <button 
          onClick={onReset}
          className="bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-slate-200"
        >
          {isShared ? "내 정보로 직접 만들기" : "새로운 시험 결과 입력하기"}
        </button>
      </div>
    </div>
  );
};

export default ReportView;
