
import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "../types";

export const getStudentFeedback = async (result: EvaluationResult): Promise<string> => {
  // 호출 시점에 환경 변수에서 API 키를 가져옵니다.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API_KEY is missing.");
  }

  try {
    // 매번 새로운 인스턴스를 생성하여 최신 키가 반영되도록 함
    const ai = new GoogleGenAI({ apiKey });
    
    const categorySummary = result.categoryResults
      .map(c => `${c.category}: ${c.percentage.toFixed(1)}% (${c.correctCount}/${c.totalQuestions})`)
      .join(", ");

    const prompt = `
      학생 이름: ${result.studentName}
      총점: ${result.totalScore} / ${result.maxScore}
      영역별 성취도: ${categorySummary}

      위 데이터를 바탕으로 학생에게 격려와 학습 조언이 담긴 따뜻한 피드백을 한글로 3~4문장 작성해주세요. 
      칭찬과 구체적인 학습 방향을 포함해주세요. '입니다'체로 정중하게 작성해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt, // contents는 문자열이나 파츠 객체 가능
    });

    return response.text || "피드백을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
