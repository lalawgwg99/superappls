import { GoogleGenAI, Type } from "@google/genai";
import { ProductPerformance, SeasonalityData, ProductDecision, DecisionTag, LifecycleStage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDecisionMatrix = async (
  performanceData: ProductPerformance[],
  seasonalityData: SeasonalityData[]
): Promise<{ decisions: ProductDecision[]; overallSummary: string }> => {
  // Use Gemini 3 Pro for advanced reasoning (replacing 2.5 Pro which is not available)
  const modelId = "gemini-3-pro-preview";

  // Context Optimization: 
  // We cannot send thousands of rows. We send a representative sample:
  // 1. All 'A' Class items (Core)
  // 2. Top 5 'B' Class items
  // 3. Bottom 5 'C' Class items (candidates for deletion)
  
  const aClass = performanceData.filter(p => p.cumulativeShare <= 80);
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
    1. 商品表現 (Product Performance):
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

  const response = await ai.models.generateContent({
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

  const text = response.text;
  if (!text) throw new Error("AI Analysis returned empty result.");
  
  return JSON.parse(text);
};
