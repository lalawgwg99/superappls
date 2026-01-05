
// Raw Data Row from Excel
export interface SalesRecord {
  Date: string; // YYYY-MM-DD or YYYY-MM
  Category: string;
  Product: string;
  Quantity: number;
  Amount: number;
  Cost?: number; // Optional
  Brand: string; // New field derived from Product Name
}

// 1. Sales Contribution (Pareto / ABC)
export enum ABCClass {
  A = 'A (核心)',
  B = 'B (常規)',
  C = 'C (長尾)',
}

export enum LifecycleStage {
  NEW = '新品導入',
  GROWTH = '成長期',
  MATURE = '成熟期',
  DECLINE = '衰退期',
}

export interface ProductPerformance {
  productName: string;
  category: string;
  totalQty: number;
  totalAmount: number;
  averagePrice: number;
  
  // Advanced Metrics
  qtyShare: number;
  amountShare: number;
  cumulativeShare: number;
  abcClass: ABCClass;
  
  // Velocity Metrics
  salesFrequency: number; // How many unique days/months it sold
  velocityScore: number; // Normalized score 0-100

  // Index signature for Recharts compatibility
  [key: string]: any;
}

// 2. Seasonality
export interface SeasonalityData {
  month: string;
  sales: number;
  revenue: number;
  topCategory: string;
  [key: string]: any;
}

// 3. Price Band Analysis
export interface PriceBandMetric {
  range: string;
  salesCount: number;
  revenue: number;
  percent: number;
  [key: string]: any;
}

// 4. Brand Analysis (New)
export interface BrandMetric {
  brand: string;
  revenue: number;
  salesCount: number; // Added for volume analysis
  percentage: number;
  [key: string]: any;
}

// 5. Daily Trend (New)
export interface DailyTrendMetric {
  date: string;
  revenue: number;
  orders: number;
  [key: string]: any;
}

// 6. Decision Matrix (Gemini Output)
export enum DecisionTag {
  MAIN_STOCK = '主力進貨 (High Stock)',
  DISPLAY_ONLY = '形象陳列 (Display Only)',
  STOP_ORDER = '停止進貨 (Drop)',
  WATCH_LIST = '觀察名單 (Watch)'
}

export interface ProductDecision {
  productName: string;
  category: string;
  tag: DecisionTag;
  lifecycle: LifecycleStage;
  reason: string;
  action: string;
}

export interface AnalysisResult {
  performanceMetrics: ProductPerformance[];
  seasonality: SeasonalityData[];
  priceBands: PriceBandMetric[];
  brandDistribution: BrandMetric[]; // New
  dailyTrend: DailyTrendMetric[]; // New
  decisions: ProductDecision[];
  overallSummary: string;
}

export interface RawInputData {
  fileName: string;
  records: SalesRecord[];
}

// --- Legacy Types for ForecastReport.tsx & TrendChart.tsx ---

export interface RecommendationItem {
  category: string;
  productName: string;
  suggestedQty: string | number;
  reason: string;
}

export interface InventoryAlert {
  alertType: 'STOCKOUT_RISK' | 'OVERSTOCK_RISK' | string;
  riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  productName: string;
  description: string;
  suggestedThreshold: string | number;
}

export interface ExternalFactorImpact {
  factorName: string;
  impactDescription: string;
  affectedCategories: string[];
  adjustmentSuggestion: string;
}

export interface ForecastResponse {
  overallStrategy: string;
  inventoryAlerts: InventoryAlert[];
  safeBets: RecommendationItem[];
  highRisk: RecommendationItem[];
  warnings: RecommendationItem[];
  externalFactorAnalysis: ExternalFactorImpact[];
}

export interface ChartDataPoint {
  month: string;
  category: string;
  sales: number;
}
