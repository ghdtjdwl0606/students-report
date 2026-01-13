
import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "../types";

export const getStudentFeedback = async (result: EvaluationResult): Promise<string> => {
  // 호출 직전에 process.env.API_KEY를 참조하여 최신 상태를 유지합니다.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    // 매번 새로운 인스턴스를 생성하여 주입된 API 키를 확실히 반영합니다.
    const ai = new GoogleGenAI({ apiKey });
    
    const categorySummary = result.categoryResults
      .map(c => `${c.category}: ${c.percentage.toFixed(1)}% (${c.correctCount}/${c.totalQuestions})`)
      .join(", ");

    const prompt = `
      학생 이름: ${result.studentName}
      총점: ${result.totalScore} / ${result.maxScore}
      영역별 성취도: ${categorySummary}

      위 데이터를 바탕으로 학생의 성적을 분석하고, 따뜻한 격려와 함께 구체적인 학습 조언을 한글로 3~4문장 작성해주세요.
      - 잘한 영역에 대해서는 칭찬을 아끼지 마세요.
      - 부족한 영역은 어떻게 보완하면 좋을지 전문적인 교사의 관점에서 제안해주세요.
      - 말투는 '~해요', '~입니다'와 같이 부드러운 평어체/경어체를 혼합해 사용해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        thinkingConfig: { thinkingBudget: 0 } // 빠른 응답을 위해 씽킹 버짓을 0으로 설정 가능
      }
    });

    return response.text || "성적 분석 내용을 생성할 수 없습니다.";
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    
    const errorMessage = error.message || "";
    
    // 특정 에러 상황에 따른 에러 코드 반환
    if (errorMessage.includes("Requested entity was not found")) {
      throw new Error("MODEL_NOT_FOUND");
    }
    if (errorMessage.includes("API key not valid") || errorMessage.includes("403")) {
      throw new Error("INVALID_API_KEY");
    }
    
    throw new Error("GENERIC_AI_ERROR");
  }
};
