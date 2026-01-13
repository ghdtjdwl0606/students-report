
import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "../types";

export const getStudentFeedback = async (result: EvaluationResult): Promise<string> => {
  // API 키를 환경 변수에서 직접 가져옵니다.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.warn("Gemini API_KEY is missing in environment variables.");
    return "AI 분석 기능을 사용하려면 관리자 설정에서 Gemini API 키를 입력해야 합니다.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const categorySummary = result.categoryResults
      .map(c => `${c.category}: ${c.percentage.toFixed(1)}% (${c.correctCount}/${c.totalQuestions})`)
      .join(", ");

    const prompt = `
      학생 이름: ${result.studentName}
      총점: ${result.totalScore} / ${result.maxScore}
      영역별 성취도: ${categorySummary}

      위 데이터를 바탕으로 학생에게 격려와 학습 조언이 담긴 따뜻한 피드백을 한글로 3~4문장 작성해주세요. 
      칭찬과 구체적인 학습 방향을 포함해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "피드백을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 분석 중 오류가 발생했습니다. API 키가 유효한지 확인해주세요.";
  }
};
