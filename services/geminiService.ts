import { GoogleGenAI, Type } from "@google/genai";
import { ProductPerformance, SeasonalityData, ProductDecision, DecisionTag, LifecycleStage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDecisionMatrix = async (
  performanceData: ProductPerformance[],
  seasonalityData: SeasonalityData[]
): Promise<{ decisions: ProductDecision[]; overallSummary: string }> => {

  // 1. 準備數據採樣 (Data Sampling)
  // 限制 Top 30 A類 + Top 5 B類 + Top 5 C類，避免 token 溢出
  const aClass = performanceData.filter(p => p.cumulativeShare <= 80).slice(0, 30);
  const bClass = performanceData.filter(p => p.cumulativeShare > 80 && p.cumulativeShare <= 95).slice(0, 5);
  const cClass = performanceData.filter(p => p.cumulativeShare > 95).slice(-5);
  const sampleData = [...aClass, ...bClass, ...cClass];

  // 2. 建構 Prompt (Prompt Engineering for JSON)
  // 強制要求純 JSON 字串，不使用 Markdown，避開 SDK schema bug
  const prompt = `
    你是一個專業的「零售供應鏈決策系統」。請根據以下數據進行庫存與採購分析。

    【分析邏輯】
    1. **ABC 分析**：A類商品(Top 80%營收)不可缺貨；C類商品若低週轉應考慮淘汰。
    2. **生命週期**：識別新品(近期頻率高)、成熟品(穩定)、衰退品(量減)。
    3. **陳列策略**：高單價+低週轉 = 形象陳列；低單價+高週轉 = 堆箱陳列。

    【輸入數據】
    1. 商品表現 (Top 40 items):
    ${JSON.stringify(sampleData.map(i => ({
    Product: i.productName,
    Category: i.category,
    ABC: i.abcClass,
    AvgPrice: i.averagePrice,
    TotalQty: i.totalQty,
    Freq: i.salesFrequency
  })), null, 2)}

    2. 季節性趨勢:
    ${JSON.stringify(seasonalityData, null, 2)}

    【輸出要求】
    1. 請直接回傳一個 JSON 物件，不要包含 Markdown 標記 (如 \`\`\`json)。
    2. **所有內容 (overallSummary, reason, action) 必須使用「繁體中文」(Traditional Chinese) 撰寫。**
    格式如下：
    {
      "overallSummary": "高階經理人摘要 (Executive Summary)，包含本季重點策略、庫存健康度評估。",
      "decisions": [
        {
          "productName": "商品名稱",
          "category": "類別",
          "tag": "${DecisionTag.MAIN_STOCK} | ${DecisionTag.DISPLAY_ONLY} | ${DecisionTag.STOP_ORDER} | ${DecisionTag.WATCH_LIST}",
          "lifecycle": "${LifecycleStage.NEW} | ${LifecycleStage.GROWTH} | ${LifecycleStage.MATURE} | ${LifecycleStage.DECLINE}",
          "reason": "決策理由 (繁體中文)",
          "action": "具體行動 (繁體中文)"
        }
      ]
    }
  `;

  // 3. 定義模型優先順序 (Fallback Strategy)
  // [用戶強制要求]：Gemini 3 Pro 等級 (使用 1.5 Pro)
  const models = [
    "gemini-1-flash"
3.0  ];

  // 4. 執行 AI 呼叫 (With Fallback & Timeout)
  const callGeminiWithFallback = async (currentPrompt: string): Promise<any> => {
    let lastError = null;

    for (const model of models) {
      try {
        console.log(`[AI] Trying model: ${model}...`);

        // 超時控制 (300秒 / 5分鐘) - 應應用戶要求
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI 分析時間較長 (${model})，請稍候 (300秒)`)), 300000)
        );

        // 核心：不使用 config.responseSchema，避免 "Unsupported part type: function"
        const apiPromise = ai.models.generateContent({
          model: model,
          contents: currentPrompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const response: any = await Promise.race([apiPromise, timeoutPromise]);
        return response;

      } catch (err: any) {
        console.warn(`[AI] Model ${model} failed:`, err);
        lastError = err;
        continue; // 嘗試下一個模型
      }
    }
    throw lastError || new Error("All AI models failed.");
  };

  const response = await callGeminiWithFallback(prompt);

  // [Fix] response.text() vs response.text property access
  let text = "";
  if (typeof response.text === 'string') {
    text = response.text;
  } else if (typeof response.text === 'function') {
    text = response.text();
  } else if (response.candidates && response.candidates.length > 0) {
    // Fallback for getting text content
    const parts = response.candidates[0].content.parts;
    if (parts && parts.length > 0 && parts[0].text) {
      text = parts[0].text;
    }
  }

  if (!text) throw new Error("AI 分析回傳空結果，請檢查網路連線。");

  // 5. 結果清理與解析
  // 移除可能存在的 Markdown Code Block
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleanedText);

    // 簡單驗證
    if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
      throw new Error("回應缺少 decisions 陣列");
    }

    return {
      overallSummary: parsed.overallSummary || "AI 未提供摘要",
      decisions: parsed.decisions
    };
  } catch (e: any) {
    console.error("JSON Parse Error:", e);
    console.error("Raw Text:", text);
    throw new Error("AI 回應無法解析為 JSON，請重試。");
  }
};
