
import { SalesRecord, ProductPerformance, SeasonalityData, PriceBandMetric, ABCClass, BrandMetric, DailyTrendMetric } from '../types';

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
 * Heuristic to map dynamic column names to our standard SalesRecord format.
 * Includes logic to remove exact duplicate rows to support multi-file merging.
 */
export const normalizeData = (rawData: any[]): SalesRecord[] => {
  const seenRows = new Set<string>();

  return rawData.map((row): SalesRecord | null => {
    const keys = Object.keys(row);
    const getVal = (patterns: string[]) => {
      const key = keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
      return key ? row[key] : null;
    };

    const dateVal = getVal(['date', '日期', '時間', 'month', 'day']);
    const catVal = getVal(['category', 'cat', '類別', '品類', '部門', '類型']); 
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

    // Deduplication Key
    const rowKey = `${dateStr}|${productName}|${qty}|${amount}`;
    if (seenRows.has(rowKey)) {
      return null; // Duplicate
    }
    seenRows.add(rowKey);

    return {
      Date: dateStr,
      Category: String(catVal || '未分類'),
      Product: productName,
      Quantity: qty,
      Amount: amount,
      Cost: costVal ? Number(costVal) : undefined,
      Brand: detectBrand(productName)
    };
  }).filter((r): r is SalesRecord => r !== null && (r.Quantity > 0 || r.Amount > 0)); 
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
