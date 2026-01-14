
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
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const sectionDesc = CATEGORY_DESCRIPTIONS[data.section] || {};
    const description = sectionDesc[data.category.trim()] || "이 영역에 대한 학습 성취도를 나타냅니다.";

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 max-w-[280px]">
        <div className="flex justify-between items-start gap-4 mb-2">
          <p className="font-bold text-indigo-300 text-sm leading-tight">{data.category}</p>
          <p className="text-xs font-black bg-indigo-500 px-2 py-0.5 rounded-lg">{Math.round(data.percentage)}%</p>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300 font-medium">
          {description}
        </p>
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
      // PDF 최적화를 위한 가상 고정폭 렌더링 전략
      const originalElement = reportRef.current;
      
      // 1. 가상 컨테이너 생성 (A4 비율에 최적화된 너비)
      const pdfWidth = 1200; // 고해상도 캡처를 위한 기준 너비
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = `${pdfWidth}px`;
      container.style.backgroundColor = '#f8fafc';
      document.body.appendChild(container);

      // 2. 요소 복제 및 스타일 보정
      const clone = originalElement.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${pdfWidth}px`;
      clone.style.padding = '40px'; // PDF 여백 확보
      container.appendChild(clone);

      // 3. 고해상도 캡처 (기기 해상도 영향을 무시하기 위해 scale 상향)
      const canvas = await html2canvas(clone, {
        scale: 3, 
        useCORS: true, 
        backgroundColor: '#f8fafc',
        logging: false,
        onclone: (clonedDoc) => {
          // 복제본 내의 SVG/차트가 올바르게 렌더링되도록 처리할 수 있음
        }
      });

      // 4. 가상 컨테이너 제거
      document.body.removeChild(container);

      // 5. PDF 생성
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // 6. 이미지 비율 계산하여 페이지에 안착 (여백 10mm)
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);
      pdf.save(`${studentInput.name}_성적분석리포트.pdf`);
      
    } catch (e) {
      console.error(e);
      alert("PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!result) return <div className="p-20 text-center font-bold text-slate-400">데이터를 불러오는 중입니다...</div>;

  const readingResults = result.categoryResults.filter((r: any) => r.section === 'Reading');
  const listeningResults = result.categoryResults.filter((r: any) => r.section === 'Listening');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
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
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
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
