
import { GoogleGenAI } from "@google/genai";
import { EvaluationResult } from "../types";

export const getStudentFeedback = async (result: EvaluationResult): Promise<string> => {
  // 호출 시점에 최신 API 키를 가져옵니다.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
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
      잘한 부분은 칭찬하고, 정답률이 낮은 영역은 구체적인 학습 방법을 제안해주세요. 
      선생님이 학생에게 말하는 부드러운 말투(~해요, ~입니다)를 사용해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "피드백을 생성할 수 없습니다.";
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("MODEL_NOT_FOUND");
    }
    throw error;
  }
};
