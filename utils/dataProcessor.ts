
import {
  SalesRecord, ProductPerformance, SeasonalityData, PriceBandMetric,
  ABCClass, BrandMetric, DailyTrendMetric,
  InventoryMetrics, ForecastResult, YoYComparison, ProfitAnalysis, SlowMovingAlert
} from '../types';

/**
 * Helper to detect brand from product name
 */
const detectBrand = (productName: string): string => {
  const normalized = productName.toLowerCase();

  if (normalized.includes('panasonic') || normalized.includes('國際')) return 'Panasonic 國際';
  if (normalized.includes('lg')) return 'LG 樂金';
  if (normalized.includes('samsung') || normalized.includes('三星')) return 'Samsung 三星';
  if (normalized.includes('sony') || normalized.includes('索尼')) return 'Sony';
  if (normalized.includes('hitachi') || normalized.includes('日立')) return 'Hitachi 日立';
  if (normalized.includes('toshiba') || normalized.includes('東芝')) return 'Toshiba 東芝';
  if (normalized.includes('sharp') || normalized.includes('夏普')) return 'Sharp 夏普';
  if (normalized.includes('teco') || normalized.includes('東元')) return 'TECO 東元';
  if (normalized.includes('sampo') || normalized.includes('聲寶')) return 'SAMPO 聲寶';
  if (normalized.includes('heran') || normalized.includes('禾聯')) return 'HERAN 禾聯';
  if (normalized.includes('sanlux') || normalized.includes('三洋')) return 'Sanlux 三洋';
  if (normalized.includes('sakura') || normalized.includes('櫻花')) return 'Sakura 櫻花';
  if (normalized.includes('dyson')) return 'Dyson';
  if (normalized.includes('philips') || normalized.includes('飛利浦')) return 'Philips';
  if (normalized.includes('tatung') || normalized.includes('大同')) return 'Tatung 大同';
  if (normalized.includes('whirlpool') || normalized.includes('惠而浦')) return 'Whirlpool';
  if (normalized.includes('daikin') || normalized.includes('大金')) return 'Daikin 大金';

  return 'Other 其他';
};

/**
 * Helper to detect if a product is a gift item
 */
const detectGift = (productName: string, amount: number): boolean => {
  // 金額為 0 視為贈品
  if (amount === 0) return true;

  // 名稱包含贈品相關關鍵字
  const giftKeywords = ['贈', '贈品', '禮', '附贈', '加贈', '送', '免費'];
  const normalized = productName.toLowerCase();
  return giftKeywords.some(keyword => normalized.includes(keyword));
};

/**
 * Heuristic to map dynamic column names to our standard SalesRecord format
 */
export const normalizeData = (rawData: any[]): SalesRecord[] => {
  return rawData.map(row => {
    const keys = Object.keys(row);
    const getVal = (patterns: string[]) => {
      const key = keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
      return key ? row[key] : null;
    };

    const dateVal = getVal(['date', '日期', '時間', 'month', 'day']);
    const catVal = getVal(['category', 'cat', '類別', '品類', '部門', '類型']); // Added '類型' to allow detection if needed, though usually '銷售'
    const prodVal = getVal(['product', 'name', 'model', '商品', '型號', '名稱', '品名']);
    const qtyVal = getVal(['qty', 'quantity', 'count', '數量', '銷量', 'sales_qty']);
    const amtVal = getVal(['amount', 'price', 'revenue', '金額', '售價', '總價', 'sales_amt', '營業額']);
    const costVal = getVal(['cost', '成本', '進價']);

    // Simple cleaning
    const qty = Number(qtyVal) || 0;
    const amount = Number(amtVal) || 0;
    const productName = String(prodVal || '未知商品');

    // Date normalization
    let dateStr = 'Unknown';
    if (dateVal) {
      if (typeof dateVal === 'number') {
        // Excel serial date
        const date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
        dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().slice(0, 10);
        } else {
          dateStr = String(dateVal);
        }
      }
    }

    return {
      Date: dateStr,
      Category: String(catVal || '未分類'),
      Product: productName,
      Quantity: qty,
      Amount: amount,
      Cost: costVal ? Number(costVal) : undefined,
      Brand: detectBrand(productName),
      isGift: detectGift(productName, amount)
    };
  }).filter(r => r.Quantity > 0 || r.Amount > 0); // Keep only positive sales for now
};

/**
 * 1. Sales Contribution Analysis (ABC Analysis)
 */
export const analyzePerformance = (data: SalesRecord[]): ProductPerformance[] => {
  const grouped = new Map<string, ProductPerformance>();
  let totalSystemAmount = 0;

  // 1. Aggregation
  data.forEach(row => {
    totalSystemAmount += row.Amount;
    if (!grouped.has(row.Product)) {
      grouped.set(row.Product, {
        productName: row.Product,
        category: row.Category,
        totalQty: 0,
        totalAmount: 0,
        averagePrice: 0,
        qtyShare: 0,
        amountShare: 0,
        cumulativeShare: 0,
        abcClass: ABCClass.C,
        salesFrequency: 0,
        velocityScore: 0
      });
    }
    const item = grouped.get(row.Product)!;
    item.totalQty += row.Quantity;
    item.totalAmount += row.Amount;
    // Simple frequency counter (row count as proxy for frequency in transaction data)
    item.salesFrequency += 1;
  });

  // 2. Metrics Calculation
  const result = Array.from(grouped.values()).map(item => ({
    ...item,
    amountShare: totalSystemAmount > 0 ? (item.totalAmount / totalSystemAmount) * 100 : 0,
    averagePrice: item.totalQty > 0 ? Math.round(item.totalAmount / item.totalQty) : 0,
    velocityScore: Math.min(100, item.totalQty * 1.5 + item.salesFrequency * 0.5) // Simple heuristic
  }));

  // 3. Sort for ABC Analysis (by Revenue)
  result.sort((a, b) => b.totalAmount - a.totalAmount);

  // 4. Assign ABC Class
  let currentCumulative = 0;
  result.forEach(item => {
    currentCumulative += item.amountShare;
    item.cumulativeShare = currentCumulative;

    if (currentCumulative <= 80) {
      item.abcClass = ABCClass.A;
    } else if (currentCumulative <= 95) {
      item.abcClass = ABCClass.B;
    } else {
      item.abcClass = ABCClass.C;
    }
  });

  return result;
};

/**
 * 2. Seasonality Analysis
 */
export const analyzeSeasonality = (data: SalesRecord[]): SeasonalityData[] => {
  const grouped = new Map<string, { totalQty: number; totalRev: number; categories: Record<string, number> }>();

  data.forEach(row => {
    // Extract YYYY-MM
    const month = row.Date.length >= 7 ? row.Date.substring(0, 7) : row.Date;

    if (!grouped.has(month)) {
      grouped.set(month, { totalQty: 0, totalRev: 0, categories: {} });
    }
    const entry = grouped.get(month)!;
    entry.totalQty += row.Quantity;
    entry.totalRev += row.Amount;
    entry.categories[row.Category] = (entry.categories[row.Category] || 0) + row.Quantity;
  });

  return Array.from(grouped.entries())
    .map(([month, data]) => {
      const topCat = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0];
      return {
        month,
        sales: data.totalQty,
        revenue: data.totalRev,
        topCategory: topCat ? topCat[0] : 'None'
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
};

/**
 * 3. Price Band Analysis
 */
export const analyzePriceBands = (data: SalesRecord[]): PriceBandMetric[] => {
  const bands = new Map<string, { count: number; revenue: number }>();
  let totalRev = 0;

  data.forEach(row => {
    totalRev += row.Amount;
    const price = row.Quantity > 0 ? row.Amount / row.Quantity : 0;
    let range = '';
    if (price < 3000) range = '平價 (<3k)';
    else if (price < 10000) range = '入門 (3k-10k)';
    else if (price < 25000) range = '中階 (10k-25k)';
    else if (price < 40000) range = '高階 (25k-40k)';
    else range = '旗艦 (>40k)';

    if (!bands.has(range)) bands.set(range, { count: 0, revenue: 0 });
    const b = bands.get(range)!;
    b.count += row.Quantity;
    b.revenue += row.Amount;
  });

  return Array.from(bands.entries()).map(([range, val]) => ({
    range,
    salesCount: val.count,
    revenue: val.revenue,
    percent: totalRev > 0 ? (val.revenue / totalRev) * 100 : 0
  })).sort((a, b) => {
    const order = ['平價 (<3k)', '入門 (3k-10k)', '中階 (10k-25k)', '高階 (25k-40k)', '旗艦 (>40k)'];
    return order.indexOf(a.range) - order.indexOf(b.range);
  });
};

/**
 * 4. Brand Analysis
 */
export const analyzeBrands = (data: SalesRecord[]): BrandMetric[] => {
  const brandMap = new Map<string, { revenue: number, count: number }>();
  let totalRev = 0;

  data.forEach(row => {
    const rev = row.Amount;
    const qty = row.Quantity;
    totalRev += rev;
    const brand = row.Brand;

    if (!brandMap.has(brand)) {
      brandMap.set(brand, { revenue: 0, count: 0 });
    }
    const b = brandMap.get(brand)!;
    b.revenue += rev;
    b.count += qty;
  });

  return Array.from(brandMap.entries())
    .map(([brand, data]) => ({
      brand,
      revenue: data.revenue,
      salesCount: data.count,
      percentage: totalRev > 0 ? (data.revenue / totalRev) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * 5. Daily Trend Analysis
 */
export const analyzeDailyTrend = (data: SalesRecord[]): DailyTrendMetric[] => {
  const dayMap = new Map<string, { revenue: number, orders: number }>();

  data.forEach(row => {
    // row.Date is already normalized to YYYY-MM-DD
    if (!dayMap.has(row.Date)) {
      dayMap.set(row.Date, { revenue: 0, orders: 0 });
    }
    const d = dayMap.get(row.Date)!;
    d.revenue += row.Amount;
    d.orders += 1;
  });

  return Array.from(dayMap.entries())
    .map(([date, val]) => ({
      date,
      revenue: val.revenue,
      orders: val.orders
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// ========== 核心功能增強 ==========

/**
 * 6. 庫存指標計算 (安全庫存、再訂購點、建議進貨量)
 * 公式：
 * - 安全庫存 = Z × σ × √(前置期)，Z=1.65 對應 95% 服務水準
 * - 再訂購點 = 安全庫存 + (日均銷量 × 前置期)
 * - 建議進貨量 = 日均銷量 × 30 (一個月需求)
 */
export const calculateInventoryMetrics = (
  data: SalesRecord[],
  leadTimeDays: number = 7
): InventoryMetrics[] => {
  // 計算資料涵蓋天數
  const dates = [...new Set(data.map(r => r.Date))].sort();
  const totalDays = dates.length || 1;

  // 按商品聚合
  const productMap = new Map<string, { qty: number[], category: string }>();

  data.forEach(row => {
    if (!productMap.has(row.Product)) {
      productMap.set(row.Product, { qty: [], category: row.Category });
    }
    productMap.get(row.Product)!.qty.push(row.Quantity);
  });

  const Z = 1.65; // 95% 服務水準對應的 Z 值

  return Array.from(productMap.entries()).map(([productName, info]) => {
    const totalQty = info.qty.reduce((a, b) => a + b, 0);
    const avgDailySales = totalQty / totalDays;

    // 計算標準差
    const mean = info.qty.reduce((a, b) => a + b, 0) / info.qty.length;
    const variance = info.qty.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / info.qty.length;
    const stdDev = Math.sqrt(variance);

    // 安全庫存 = Z × σ × √(前置期)
    const safetyStock = Math.ceil(Z * stdDev * Math.sqrt(leadTimeDays));

    // 再訂購點 = 安全庫存 + (日均銷量 × 前置期)
    const reorderPoint = Math.ceil(safetyStock + (avgDailySales * leadTimeDays));

    // 建議進貨量 = 30 天需求
    const suggestedOrderQty = Math.ceil(avgDailySales * 30);

    return {
      productName,
      category: info.category,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      salesVariance: Math.round(stdDev * 100) / 100,
      safetyStock,
      reorderPoint,
      suggestedOrderQty
    };
  }).sort((a, b) => b.avgDailySales - a.avgDailySales);
};

/**
 * 7. 需求預測 (3個月移動平均)
 */
export const forecastNextMonth = (seasonality: SeasonalityData[]): ForecastResult => {
  if (seasonality.length === 0) {
    return {
      nextMonthRevenue: 0,
      nextMonthQty: 0,
      trend: 'STABLE',
      trendPercent: 0,
      confidence: 'LOW',
      method: '無歷史數據'
    };
  }

  // 取最近 3 個月數據
  const recent = seasonality.slice(-3);
  const revenues = recent.map(s => s.revenue);
  const quantities = recent.map(s => s.sales);

  // 移動平均
  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const avgQty = quantities.reduce((a, b) => a + b, 0) / quantities.length;

  // 判斷趨勢
  let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
  let trendPercent = 0;

  if (revenues.length >= 2) {
    const lastMonth = revenues[revenues.length - 1];
    const prevMonth = revenues[revenues.length - 2];
    trendPercent = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

    if (trendPercent > 5) trend = 'UP';
    else if (trendPercent < -5) trend = 'DOWN';
  }

  // 信心度判斷
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (seasonality.length >= 6) confidence = 'HIGH';
  else if (seasonality.length < 3) confidence = 'LOW';

  return {
    nextMonthRevenue: Math.round(avgRevenue),
    nextMonthQty: Math.round(avgQty),
    trend,
    trendPercent: Math.round(trendPercent * 10) / 10,
    confidence,
    method: '3個月移動平均'
  };
};

/**
 * 8. 同期比較 (年增率 YoY / 月環比 MoM)
 */
export const calculateYoYComparison = (seasonality: SeasonalityData[]): YoYComparison[] => {
  // 建立月份對照表
  const monthMap = new Map<string, number>();
  seasonality.forEach(s => monthMap.set(s.month, s.revenue));

  return seasonality.map((current, index) => {
    const result: YoYComparison = {
      month: current.month,
      currentRevenue: current.revenue
    };

    // 月環比 (與上一個月比較)
    if (index > 0) {
      const prevMonth = seasonality[index - 1];
      result.previousRevenue = prevMonth.revenue;
      result.momGrowth = prevMonth.revenue > 0
        ? Math.round(((current.revenue - prevMonth.revenue) / prevMonth.revenue) * 1000) / 10
        : undefined;
    }

    // 年增率 (與去年同月比較)
    const currentYM = current.month.split('-');
    if (currentYM.length === 2) {
      const lastYearMonth = `${parseInt(currentYM[0]) - 1}-${currentYM[1]}`;
      if (monthMap.has(lastYearMonth)) {
        const lastYearRevenue = monthMap.get(lastYearMonth)!;
        result.yoyGrowth = lastYearRevenue > 0
          ? Math.round(((current.revenue - lastYearRevenue) / lastYearRevenue) * 1000) / 10
          : undefined;
      }
    }

    return result;
  });
};

/**
 * 9. 毛利分析 (需要 Cost 欄位)
 */
export const analyzeProfitMargin = (data: SalesRecord[]): ProfitAnalysis[] => {
  // 檢查是否有成本資料
  const hasCoat = data.some(r => r.Cost !== undefined && r.Cost > 0);
  if (!hasCoat) return [];

  const productMap = new Map<string, { revenue: number, cost: number, category: string }>();

  data.forEach(row => {
    if (!productMap.has(row.Product)) {
      productMap.set(row.Product, { revenue: 0, cost: 0, category: row.Category });
    }
    const p = productMap.get(row.Product)!;
    p.revenue += row.Amount;
    p.cost += (row.Cost || 0) * row.Quantity;
  });

  return Array.from(productMap.entries())
    .map(([productName, info]) => ({
      productName,
      category: info.category,
      totalRevenue: info.revenue,
      totalCost: info.cost,
      grossProfit: info.revenue - info.cost,
      marginPercent: info.revenue > 0
        ? Math.round(((info.revenue - info.cost) / info.revenue) * 1000) / 10
        : 0
    }))
    .filter(p => p.totalRevenue > 0)
    .sort((a, b) => b.marginPercent - a.marginPercent);
};

/**
 * 10. 滯銷品警示
 * 標準：超過 thresholdDays 天未銷售的商品
 */
export const detectSlowMoving = (
  data: SalesRecord[],
  thresholdDays: number = 30
): SlowMovingAlert[] => {
  // 找出資料範圍內的最後日期
  const dates = data.map(r => r.Date).filter(d => d !== 'Unknown').sort();
  if (dates.length === 0) return [];

  const lastRecordDate = new Date(dates[dates.length - 1]);
  const firstRecordDate = new Date(dates[0]);

  // 計算資料涵蓋天數
  const dataCoverageDays = Math.ceil((lastRecordDate.getTime() - firstRecordDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // 按商品聚合最後銷售日期和總銷量
  const productMap = new Map<string, { lastSale: string, totalQty: number, category: string }>();

  data.forEach(row => {
    if (!productMap.has(row.Product)) {
      productMap.set(row.Product, { lastSale: row.Date, totalQty: 0, category: row.Category });
    }
    const p = productMap.get(row.Product)!;
    p.totalQty += row.Quantity;
    if (row.Date > p.lastSale) p.lastSale = row.Date;
  });

  const alerts: SlowMovingAlert[] = [];

  productMap.forEach((info, productName) => {
    const lastSaleDate = new Date(info.lastSale);
    const daysSinceLastSale = Math.ceil((lastRecordDate.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLastSale >= thresholdDays) {
      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let recommendation = '';

      if (daysSinceLastSale >= 60) {
        riskLevel = 'HIGH';
        recommendation = '建議立即清倉或停止進貨';
      } else if (daysSinceLastSale >= 30) {
        riskLevel = 'MEDIUM';
        recommendation = '建議促銷活動或降價處理';
      } else {
        riskLevel = 'LOW';
        recommendation = '持續觀察銷售狀況';
      }

      alerts.push({
        productName,
        category: info.category,
        lastSaleDate: info.lastSale,
        daysSinceLastSale,
        totalQtyInPeriod: info.totalQty,
        riskLevel,
        recommendation
      });
    }
  });

  return alerts.sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);
};
