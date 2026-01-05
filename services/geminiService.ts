import { GoogleGenAI, Type } from "@google/genai";
import { ProductPerformance, SeasonalityData, ProductDecision, DecisionTag, LifecycleStage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDecisionMatrix = async (
  performanceData: ProductPerformance[],
  seasonalityData: SeasonalityData[]
): Promise<{ decisions: ProductDecision[]; overallSummary: string }> => {

  // 定義模型優先順序 (Fallback Strategy)
  // 1. Gemini 2.0 Flash Exp (對應 "Gemini 3 Flash" 預覽體驗)
  // 2. Gemini 1.5 Flash (各種版本號，確保相容性)
  // 3. Gemini 1.5 Pro (最後防線)
  const models = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro"
  ];

  const callGeminiWithFallback = async (currentPrompt: string): Promise<any> => {
    let lastError = null;

    for (const model of models) {
      try {
        console.log(`[AI] Trying model: ${model}...`);

        // 加入超時控制 (效能優化後延長至 180 秒確保完成)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI 分析時間較長 (${model})，請稍候 (180秒)`)), 180000)
        );

        const apiPromise = ai.models.generateContent({
          model: model,
          contents: currentPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallSummary: { type: Type.STRING, description: "高階經理人摘要 (Executive Summary)，包含本季重點策略、庫存健康度評估。" },
                decisions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      productName: { type: Type.STRING },
                      category: { type: Type.STRING },
                      tag: {
                        type: Type.STRING,
                        enum: [
                          DecisionTag.MAIN_STOCK,
                          DecisionTag.DISPLAY_ONLY,
                          DecisionTag.STOP_ORDER,
                          DecisionTag.WATCH_LIST
                        ]
                      },
                      lifecycle: {
                        type: Type.STRING,
                        enum: [
                          LifecycleStage.NEW,
                          LifecycleStage.GROWTH,
                          LifecycleStage.MATURE,
                          LifecycleStage.DECLINE
                        ]
                      },
                      reason: { type: Type.STRING, description: "決策理由 (例如: A類核心商品，週轉穩定)" },
                      action: { type: Type.STRING, description: "具體行動 (例如: 建立2週安全庫存)" }
                    },
                    required: ["productName", "category", "tag", "lifecycle", "reason", "action"]
                  }
                }
              },
              required: ["overallSummary", "decisions"]
            }
          }
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);
        return response;

      } catch (err: any) {
        console.warn(`[AI] Model ${model} failed:`, err);
        lastError = err;
        // 如果是 404 (Model Not Found) 或 5xx 錯誤，繼續嘗試下一個模型
        // 否則 (例如 API Key 錯誤) 可能直接拋出
        continue;
      }
    }
    throw lastError || new Error("All AI models failed.");
  };

  const response = await callGeminiWithFallback(prompt);

  const text = response.text;
  if (!text) throw new Error("AI 分析回傳空結果，請檢查網路連線。");

  // JSON 解析錯誤處理
  try {
    const parsed = JSON.parse(text);

    // 驗證回應結構
    if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
      throw new Error("AI 回應格式異常：缺少 decisions 陣列");
    }
    if (!parsed.overallSummary || typeof parsed.overallSummary !== 'string') {
      parsed.overallSummary = "AI 未提供策略摘要";
    }

    return parsed;
  } catch (parseError: any) {
    console.error("JSON Parse Error:", parseError, "Raw:", text?.substring(0, 500));
    throw new Error(`AI 回應解析失敗: ${parseError.message}`);
  }
};
