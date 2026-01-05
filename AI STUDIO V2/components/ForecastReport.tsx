import React from 'react';
import { ForecastResponse, RecommendationItem, InventoryAlert, ExternalFactorImpact } from '../types';
import { CheckCircle2, AlertTriangle, AlertOctagon, TrendingUp, Siren, Zap, Download } from 'lucide-react';

interface ForecastReportProps {
  data: ForecastResponse;
}

const RecommendationTable: React.FC<{
  title: string;
  items: RecommendationItem[];
  icon: React.ReactNode;
  headerColor: string;
}> = ({ title, items, icon, headerColor }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 mb-8">
    <div className={`px-6 py-4 border-b ${headerColor} flex items-center gap-2`}>
      {icon}
      <h3 className="font-bold text-lg text-gray-800">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
            <th className="px-6 py-3 font-semibold">商品類別</th>
            <th className="px-6 py-3 font-semibold">商品名稱</th>
            <th className="px-6 py-3 font-semibold text-center">建議採購量</th>
            <th className="px-6 py-3 font-semibold">分析理由</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-sm text-gray-500 font-medium">{item.category}</td>
              <td className="px-6 py-4 text-sm text-gray-800 font-bold">{item.productName}</td>
              <td className="px-6 py-4 text-sm text-center">
                <span className="inline-block bg-white border border-gray-200 px-3 py-1 rounded-full font-bold text-gray-700 shadow-sm">
                  {item.suggestedQty}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 leading-relaxed max-w-md">
                {item.reason}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                此類別目前沒有建議項目。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const AlertsSection: React.FC<{ alerts: InventoryAlert[] }> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Siren className="w-5 h-5 text-red-600" />
        庫存風險警報系統
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert, idx) => (
          <div 
            key={idx} 
            className={`
              p-4 rounded-lg border-l-4 shadow-sm flex flex-col justify-between
              ${alert.alertType === 'STOCKOUT_RISK' 
                ? 'bg-red-50 border-red-500' 
                : 'bg-orange-50 border-orange-500'}
            `}
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className={`
                  text-xs font-bold px-2 py-1 rounded uppercase tracking-wider
                  ${alert.alertType === 'STOCKOUT_RISK' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'}
                `}>
                  {alert.alertType === 'STOCKOUT_RISK' ? '缺貨風險' : '滯銷風險'}
                </span>
                {alert.riskLevel === 'HIGH' && (
                  <span className="text-xs font-bold text-red-600 animate-pulse">HIGH RISK</span>
                )}
              </div>
              <h4 className="font-bold text-gray-800 text-lg mb-1">{alert.productName}</h4>
              <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
            </div>
            <div className="mt-2 pt-3 border-t border-gray-200/50 flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">建議警戒水位</span>
              <span className="text-sm font-bold text-gray-800">{alert.suggestedThreshold}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExternalFactorsSection: React.FC<{ factors: ExternalFactorImpact[] }> = ({ factors }) => {
  if (!factors || factors.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-purple-600" />
        外部因素影響分析
      </h3>
      <div className="space-y-4">
        {factors.map((factor, idx) => (
          <div key={idx} className="bg-gradient-to-r from-purple-50 to-indigo-50 p-5 rounded-lg border border-purple-100 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-full shadow-sm shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 text-lg mb-1">{factor.factorName}</h4>
                <p className="text-gray-700 text-sm mb-3 leading-relaxed">{factor.impactDescription}</p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {factor.affectedCategories.map((cat, i) => (
                    <span key={i} className="text-xs bg-white text-purple-700 px-2 py-1 rounded border border-purple-200 font-medium">
                      {cat}
                    </span>
                  ))}
                </div>
                
                <div className="bg-white/60 p-3 rounded-md border border-purple-100">
                  <span className="text-xs font-bold text-purple-800 uppercase block mb-1">採購調整建議</span>
                  <p className="text-sm text-gray-800 font-medium">{factor.adjustmentSuggestion}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ForecastReport: React.FC<ForecastReportProps> = ({ data }) => {

  const handleDownloadCSV = () => {
    // CSV Header
    const headers = ['Report Type', 'Category', 'Product / Factor', 'Qty / Threshold', 'Description / Reason'];
    
    const rows: string[][] = [];

    // 1. Strategy
    rows.push(['Overall Strategy', '', '', '', data.overallStrategy]);

    // 2. Alerts
    data.inventoryAlerts.forEach(item => {
      rows.push([
        `Alert: ${item.alertType === 'STOCKOUT_RISK' ? 'Stockout' : 'Overstock'}`, 
        '-', 
        item.productName, 
        String(item.suggestedThreshold), 
        item.description
      ]);
    });

    // 3. Safe Bets
    data.safeBets.forEach(item => {
      rows.push(['Safe Bet', item.category, item.productName, String(item.suggestedQty), item.reason]);
    });

    // 4. High Risk
    data.highRisk.forEach(item => {
      rows.push(['High Risk', item.category, item.productName, String(item.suggestedQty), item.reason]);
    });

    // 5. Warnings
    data.warnings.forEach(item => {
      rows.push(['Warning', item.category, item.productName, String(item.suggestedQty), item.reason]);
    });

    // 6. External Factors
    data.externalFactorAnalysis.forEach(item => {
      rows.push([
         'External Factor',
         item.affectedCategories.join(', '),
         item.factorName,
         '-',
         `${item.impactDescription} -> Suggestion: ${item.adjustmentSuggestion}`
      ]);
   });

    // Generate CSV String
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create Download Link
    // \uFEFF is the BOM (Byte Order Mark) to ensure Excel opens UTF-8 files correctly with Chinese characters
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_forecast_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header with Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">預測報告結果</h2>
          <p className="text-sm text-gray-500">AI 分析完成，請查看下方建議</p>
        </div>
        <button 
          onClick={handleDownloadCSV} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors shadow-sm text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          匯出 CSV 報告
        </button>
      </div>

      {/* Strategy Summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2 text-emerald-300">本月採購戰略摘要</h3>
            <p className="text-slate-200 leading-relaxed text-lg">
              {data.overallStrategy}
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Alerts */}
      <AlertsSection alerts={data.inventoryAlerts} />

      {/* External Factors */}
      <ExternalFactorsSection factors={data.externalFactorAnalysis} />

      {/* Safe Bets */}
      <RecommendationTable
        title="必備安全牌 (Safe Bets)"
        items={data.safeBets}
        icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
        headerColor="bg-emerald-50 border-emerald-100"
      />

      {/* High Risk */}
      <RecommendationTable
        title="高風險賭注 (High Risk)"
        items={data.highRisk}
        icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
        headerColor="bg-amber-50 border-amber-100"
      />

      {/* Warnings */}
      <RecommendationTable
        title="庫存警告 (Warning)"
        items={data.warnings}
        icon={<AlertOctagon className="w-6 h-6 text-rose-600" />}
        headerColor="bg-rose-50 border-rose-100"
      />
    </div>
  );
};

export default ForecastReport;