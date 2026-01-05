import { GoogleGenAI, Type } from "@google/genai";
import { ProductPerformance, SeasonalityData, ProductDecision, DecisionTag, LifecycleStage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDecisionMatrix = async (
  performanceData: ProductPerformance[],
  seasonalityData: SeasonalityData[]
): Promise<{ decisions: ProductDecision[]; overallSummary: string }> => {
  // 🚀 Dual Model Strategy: 使用 Gemini 2.0 Flash 獲得極致速度與推論能力
  // 此模型比 1.5 Pro 快 5-10 倍，且具備更強的邏輯能力
  const modelId = "gemini-2.0-flash-exp";

  // Context Optimization: 
  // We cannot send thousands of rows. We send a representative sample:
  // 1. Top 30 'A' Class items (Core Revenue Drivers) - Capped to prevent timeout
  // 2. Top 5 'B' Class items
  // 3. Bottom 5 'C' Class items (candidates for deletion)

  const aClass = performanceData.filter(p => p.cumulativeShare <= 80).slice(0, 30);
  const bClass = performanceData.filter(p => p.cumulativeShare > 80 && p.cumulativeShare <= 95).slice(0, 5);
  const cClass = performanceData.filter(p => p.cumulativeShare > 95).slice(-5);

  const sampleData = [...aClass, ...bClass, ...cClass];

  const prompt = `
    你是一個專業的「零售供應鏈決策系統」。請根據以下數據進行庫存與採購分析。

    【分析邏輯】
    1. **ABC 分析**：A類商品(Top 80%營收)不可缺貨；C類商品若低週轉應考慮淘汰。
    2. **生命週期**：識別新品(近期頻率高)、成熟品(穩定)、衰退品(量減)。
    3. **陳列策略**：高單價+低週轉 = 形象陳列；低單價+高週轉 = 堆箱陳列。

    【輸入數據】
    1. 商品表現 (Product Performance - Top 40 items):
    ${JSON.stringify(sampleData.map(i => ({
    Product: i.productName,
    Category: i.category,
    ABC: i.abcClass,
    AvgPrice: i.averagePrice,
    TotalQty: i.totalQty,
    Freq: i.salesFrequency
  })), null, 2)}

    2. 季節性趨勢 (Seasonality):
    ${JSON.stringify(seasonalityData, null, 2)}

    【輸出要求】
    請針對上述每一個商品提供決策建議。
    特別注意：若為 C 類且頻率低，請大膽建議「${DecisionTag.STOP_ORDER}」。
    若為 A 類，請建議「${DecisionTag.MAIN_STOCK}」。
  `;

  // 加入超時控制 (效能優化後延長至 180 秒確保完成)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI 分析時間較長，請稍候 (180秒)")), 180000)
  );

  const apiPromise = ai.models.generateContent({
    model: modelId,
    contents: prompt,
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
