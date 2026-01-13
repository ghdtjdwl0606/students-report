
import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "../types";

export const getStudentFeedback = async (result: EvaluationResult): Promise<string> => {
  // 환경 변수 안전하게 가져오기
  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) ? process.env.API_KEY : "";

  if (!apiKey) {
    return "AI 분석 기능을 사용하려면 API 키 설정이 필요합니다.";
  }

  // 호출 시점에 인스턴스 생성
  const ai = new GoogleGenAI({ apiKey });

  const categorySummary = result.categoryResults
    .map(c => `${c.category}: ${c.percentage.toFixed(1)}% (${c.correctCount}/${c.totalQuestions})`)
    .join(", ");

  const prompt = `
    학생 이름: ${result.studentName}
    총점: ${result.totalScore} / ${result.maxScore}
    영역별 성취도: ${categorySummary}

    위 성적표 데이터를 바탕으로 학생에게 격려와 학습 조언이 담긴 따뜻한 피드백을 한글로 작성해줘. 
    전문적인 교사 톤으로, 잘한 부분은 칭찬하고 부족한 부분은 구체적인 학습 방향을 제시해줘. 
    3~4문장 정도로 정중하게 작성해줘.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "피드백을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "성적 분석 중 오류가 발생했습니다. (API 키를 확인해주세요)";
  }
};
