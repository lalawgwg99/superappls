import { GoogleGenAI } from "@google/genai";
import { SalesRecord, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

/**
 * 產生銷售數據摘要供 AI 上下文使用
 */
const generateDataContext = (
    rawRecords: SalesRecord[],
    analysisResult: AnalysisResult | null
): string => {
    if (!analysisResult || rawRecords.length === 0) {
        return "目前沒有載入任何銷售數據。";
    }

    // 品牌銷售摘要
    const brandSummary = analysisResult.performanceMetrics
        .reduce((acc, p) => {
            const brand = rawRecords.find(r => r.Product === p.productName)?.Brand || '其他';
            if (!acc[brand]) acc[brand] = { qty: 0, amount: 0 };
            acc[brand].qty += p.totalQty;
            acc[brand].amount += p.totalAmount;
            return acc;
        }, {} as Record<string, { qty: number; amount: number }>);

    const brandLines = Object.entries(brandSummary)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 10)
        .map(([brand, data]) => `- ${brand}: ${data.qty}台, $${data.amount.toLocaleString()}`);

    // Top 10 商品
    const topProducts = analysisResult.performanceMetrics
        .slice(0, 10)
        .map(p => `- ${p.productName}: ${p.totalQty}台, $${p.totalAmount.toLocaleString()}`);

    // 總體數據
    const totalQty = analysisResult.performanceMetrics.reduce((a, b) => a + b.totalQty, 0);
    const totalAmount = analysisResult.performanceMetrics.reduce((a, b) => a + b.totalAmount, 0);

    return `
【銷售數據摘要】
總品項數：${analysisResult.performanceMetrics.length}
總銷售量：${totalQty} 台
總營收：$${totalAmount.toLocaleString()}

【品牌銷售排名 Top 10】
${brandLines.join('\n')}

【商品銷售排名 Top 10】
${topProducts.join('\n')}

【AI 策略摘要】
${analysisResult.overallSummary || '無'}
  `.trim();
};

/**
 * AI 對話 - 自然語言查詢銷售數據
 */
export const askSalesQuestion = async (
    question: string,
    rawRecords: SalesRecord[],
    analysisResult: AnalysisResult | null,
    chatHistory: ChatMessage[] = []
): Promise<string> => {
    const modelId = "gemini-2.0-flash";

    const dataContext = generateDataContext(rawRecords, analysisResult);

    // 建立對話歷史
    const historyText = chatHistory
        .slice(-6) // 只保留最近 6 則對話
        .map(m => `${m.role === 'user' ? '用戶' : 'AI'}：${m.content}`)
        .join('\n');

    const prompt = `
你是一個專業的家電銷售數據分析助手。請根據以下銷售數據回答用戶的問題。

${dataContext}

${historyText ? `【對話歷史】\n${historyText}\n` : ''}

【用戶問題】
${question}

【回答規則】
1. 直接回答問題，不要廢話
2. 如果問到具體數字，請從上面的數據中查找
3. 如果數據中沒有相關資訊，誠實說「資料中沒有這項數據」
4. 使用繁體中文回答
5. 回答簡潔，最多 200 字
  `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt
        });

        return response.text || "抱歉，無法取得回應。";
    } catch (error: any) {
        console.error("AI Chat Error:", error);
        throw new Error(`對話失敗：${error.message}`);
    }
};
