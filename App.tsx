
import React, { useState } from 'react';
import { LayoutDashboard, AlertCircle, Database } from 'lucide-react';
import InputSection from './components/InputSection';
import AnalysisDashboard from './components/AnalysisDashboard';
import AIChatPanel from './components/AIChatPanel';
import { SalesRecord, AnalysisResult } from './types';
import {
  analyzePerformance, analyzeSeasonality, analyzePriceBands, analyzeBrands, analyzeDailyTrend,
  calculateInventoryMetrics, forecastNextMonth, calculateYoYComparison, analyzeProfitMargin, detectSlowMoving
} from './utils/dataProcessor';
import { generateDecisionMatrix } from './services/geminiService';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [rawRecords, setRawRecords] = useState<SalesRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDataLoaded = async (records: SalesRecord[], fileName: string) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setRawRecords(records);

    try {
      // 1. Client-side Data Science Analysis
      const performance = analyzePerformance(records);
      const seasonality = analyzeSeasonality(records);
      const priceBands = analyzePriceBands(records);
      const brandDistribution = analyzeBrands(records);
      const dailyTrend = analyzeDailyTrend(records);

      // 1.5 核心功能增強計算
      const inventoryMetrics = calculateInventoryMetrics(records);
      const forecast = forecastNextMonth(seasonality);
      const yoyComparison = calculateYoYComparison(seasonality);
      const profitAnalysis = analyzeProfitMargin(records);
      const slowMovingAlerts = detectSlowMoving(records);

      if (performance.length === 0) {
        throw new Error("無法從檔案中解析出有效數據，請檢查欄位名稱 (需包含商品、金額、日期)");
      }

      // 2. AI Qualitative Analysis (Decision Engine)
      const aiResult = await generateDecisionMatrix(performance, seasonality);

      // 3. Combine all results
      setAnalysisResult({
        performanceMetrics: performance,
        seasonality: seasonality,
        priceBands: priceBands,
        brandDistribution: brandDistribution,
        dailyTrend: dailyTrend,
        decisions: aiResult.decisions,
        overallSummary: aiResult.overallSummary,
        // 新增核心功能
        inventoryMetrics,
        forecast,
        yoyComparison,
        profitAnalysis,
        slowMovingAlerts
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "分析過程中發生錯誤，請檢查檔案格式或網路連線。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-6 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">家電銷售資料智能分析系統</h1>
              <p className="text-xs text-slate-400">Data Science & AI Decision Engine</p>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">Powered by</span>
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Gemini 3 Pro + TypeScript Analysis
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-bold">分析中止</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Input Section (Always visible until data loaded, then maybe smaller? Keeping it simple for now) */}
        {!analysisResult && (
          <div className="max-w-2xl mx-auto mb-12">
            <InputSection onDataLoaded={handleDataLoaded} isLoading={isLoading} />
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>系統將在本地端進行資料清洗與計算 (Data Cleansing & Calculation)，</p>
              <p>僅將統計結果傳送至 AI 進行策略決策。</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !analysisResult && (
          <div className="max-w-4xl mx-auto text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-gray-700">正在啟動智能分析引擎...</h3>
            <p className="text-gray-500 mt-2">1. 解析 Excel 結構... OK</p>
            <p className="text-gray-500">2. 計算 Pareto 貢獻度與價格帶...</p>
            <p className="text-gray-500">3. 呼叫 Gemini 生成決策矩陣...</p>
          </div>
        )}

        {/* Results Dashboard */}
        {analysisResult && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">分析報告</h2>
              <button
                onClick={() => setAnalysisResult(null)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ← 上傳新檔案
              </button>
            </div>
            <AnalysisDashboard data={analysisResult} rawRecords={rawRecords} />
          </div>
        )}

        {/* AI 對話浮動視窗 */}
        {analysisResult && (
          <AIChatPanel rawRecords={rawRecords} analysisResult={analysisResult} />
        )}

      </main>
    </div>
  );
};

export default App;
