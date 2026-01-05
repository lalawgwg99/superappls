
import React, { useState, useMemo } from 'react';
import { AnalysisResult, DecisionTag, LifecycleStage, ABCClass, SalesRecord } from '../types';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Area, AreaChart, ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie
} from 'recharts';
import { 
  AlertCircle, CheckCircle, PackageMinus, TrendingUp, Archive, 
  Download, Eye, Activity, Box, DollarSign, PieChart as PieIcon, Calendar, Filter
} from 'lucide-react';
import { analyzePerformance, analyzeSeasonality, analyzePriceBands, analyzeBrands, analyzeDailyTrend } from '../utils/dataProcessor';

interface Props {
  data: AnalysisResult;
  rawRecords: SalesRecord[];
}

const AnalysisDashboard: React.FC<Props> = ({ data, rawRecords }) => {
  const [activeTab, setActiveTab] = useState<'strategy' | 'matrix' | 'details'>('strategy');

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterBrand, setFilterBrand] = useState<string>('All');
  const [filterABC, setFilterABC] = useState<string>('All');

  // Extract Filter Options (from rawRecords for completeness)
  const categories = useMemo(() => ['All', ...Array.from(new Set(rawRecords.map(r => r.Category))).sort()], [rawRecords]);
  const brands = useMemo(() => ['All', ...Array.from(new Set(rawRecords.map(r => r.Brand))).sort()], [rawRecords]);
  const abcClasses = ['All', ABCClass.A, ABCClass.B, ABCClass.C];

  // Dynamic Calculation based on filters
  const filteredData = useMemo(() => {
    let filteredRecords = rawRecords;

    // 1. Filter Raw Records
    if (filterCategory !== 'All') {
      filteredRecords = filteredRecords.filter(r => r.Category === filterCategory);
    }
    if (filterBrand !== 'All') {
      filteredRecords = filteredRecords.filter(r => r.Brand === filterBrand);
    }

    // 2. ABC Filtering Logic
    // ABC Class is usually a global property. We should filter records based on their Global ABC Class.
    // We map Product -> Global ABC Class using the initial `data.performanceMetrics`.
    if (filterABC !== 'All') {
       const targetProducts = new Set(
         data.performanceMetrics
           .filter(p => p.abcClass === filterABC)
           .map(p => p.productName)
       );
       filteredRecords = filteredRecords.filter(r => targetProducts.has(r.Product));
    }

    // 3. Re-run Aggregations on Filtered Data
    // We re-calculate charts so they reflect only the selected subset (e.g., only "Panasonic" seasonality)
    const seasonality = analyzeSeasonality(filteredRecords);
    const priceBands = analyzePriceBands(filteredRecords);
    const brandDistribution = analyzeBrands(filteredRecords);
    const dailyTrend = analyzeDailyTrend(filteredRecords);
    
    // For Performance Metrics (Tables/Pareto), we also re-calculate to show correct sums for the filtered view.
    // However, we want to PRESERVE the ABC Class from the global context to avoid confusion.
    const localMetrics = analyzePerformance(filteredRecords);
    const performanceMetrics = localMetrics.map(local => {
        const globalMetric = data.performanceMetrics.find(g => g.productName === local.productName);
        return {
            ...local,
            abcClass: globalMetric?.abcClass || local.abcClass // Keep global ABC class if available
        };
    });

    // 4. Filter Decisions
    // Only show decisions for products present in the filtered view
    const visibleProducts = new Set(performanceMetrics.map(p => p.productName));
    const decisions = data.decisions.filter(d => visibleProducts.has(d.productName));

    return {
      performanceMetrics,
      seasonality,
      priceBands,
      brandDistribution,
      dailyTrend,
      decisions
    };
  }, [rawRecords, filterCategory, filterBrand, filterABC, data.decisions, data.performanceMetrics]);


  // Helpers
  const fmt = (n: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);
  const fmtNum = (n: number) => new Intl.NumberFormat('zh-TW').format(n);

  // Prepare Scatter Data
  const scatterData: any[] = filteredData.performanceMetrics.map(p => ({
    x: p.averagePrice,
    y: p.totalQty,
    z: p.totalAmount, 
    name: p.productName,
    abc: p.abcClass
  }));

  const dataA = scatterData.filter(d => d.abc === ABCClass.A);
  const dataB = scatterData.filter(d => d.abc === ABCClass.B);
  const dataC = scatterData.filter(d => d.abc === ABCClass.C);
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

  // CSV Export Logic
  const handleExport = () => {
    const headers = ['決策標籤', '商品名稱', '類別', 'ABC分級', '生命週期', '分析理由', '行動建議', '總銷量', '平均單價'];
    const rows = filteredData.decisions.map(d => {
      const metric = filteredData.performanceMetrics.find(m => m.productName === d.productName);
      return [
        d.tag,
        d.productName,
        d.category,
        metric?.abcClass || '-',
        d.lifecycle,
        d.reason,
        d.action,
        metric?.totalQty || 0,
        metric?.averagePrice || 0
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Decision_Matrix_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLifecycleColor = (stage: LifecycleStage) => {
    switch (stage) {
      case LifecycleStage.NEW: return 'text-blue-600 bg-blue-50 border-blue-200';
      case LifecycleStage.GROWTH: return 'text-green-600 bg-green-50 border-green-200';
      case LifecycleStage.MATURE: return 'text-purple-600 bg-purple-50 border-purple-200';
      case LifecycleStage.DECLINE: return 'text-gray-500 bg-gray-100 border-gray-200';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* 0. Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-4 sticky top-[80px] z-40">
          <div className="flex items-center gap-2 text-gray-700 font-bold whitespace-nowrap">
              <Filter className="w-5 h-5 text-blue-600" />
              資料篩選
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
              <select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              >
                  <option value="All">所有類別 (Category)</option>
                  {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={filterBrand} 
                onChange={e => setFilterBrand(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              >
                  <option value="All">所有品牌 (Brand)</option>
                  {brands.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select 
                value={filterABC} 
                onChange={e => setFilterABC(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              >
                  <option value="All">所有分級 (ABC Class)</option>
                  {abcClasses.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
          </div>
      </div>

      {/* 1. High-Level Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Box className="w-4 h-4" /> 分析品項數
          </div>
          <div className="text-2xl font-bold text-gray-800">{filteredData.performanceMetrics.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" /> 總營收規模
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {fmt(filteredData.performanceMetrics.reduce((a, b) => a + b.totalAmount, 0))}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Activity className="w-4 h-4" /> A類核心商品數
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {filteredData.performanceMetrics.filter(p => p.abcClass === ABCClass.A).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <PackageMinus className="w-4 h-4" /> 建議淘汰 (C類)
          </div>
          <div className="text-2xl font-bold text-red-500">
            {filteredData.performanceMetrics.filter(p => p.abcClass === ABCClass.C).length}
          </div>
        </div>
      </div>

      {/* 2. Executive Summary (Always show global summary, maybe add a note) */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-emerald-400">
          <TrendingUp className="w-5 h-5" />
          AI 策略摘要 (Global Context)
        </h2>
        <p className="leading-relaxed text-slate-200">
          {data.overallSummary}
        </p>
      </div>

      {/* 3. Main Navigation */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 rounded-t-xl overflow-hidden shadow-sm">
        <button 
          onClick={() => setActiveTab('strategy')}
          className={`flex-1 py-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'strategy' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          策略總覽 (Strategy)
        </button>
        <button 
          onClick={() => setActiveTab('matrix')}
          className={`flex-1 py-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'matrix' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          商品矩陣分析 (BCG Matrix)
        </button>
        <button 
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-4 font-medium text-sm transition-colors border-b-2 ${activeTab === 'details' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          詳細決策清單 (Action List)
        </button>
      </div>

      {/* 4. Tab Content */}
      <div className="min-h-[500px]">
        
        {/* === TAB: STRATEGY === */}
        {activeTab === 'strategy' && (
          <div className="space-y-6">
            
            {/* Brand Performance Section */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Brand Revenue Distribution */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-blue-500" />
                  品牌營收貢獻 (Revenue Share)
                </h3>
                <div className="h-[300px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={filteredData.brandDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="revenue"
                        nameKey="brand"
                      >
                        {filteredData.brandDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => fmt(val)} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Brand Volume (Sales Count) - NEW */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Box className="w-5 h-5 text-purple-500" />
                  品牌銷售數量 (Volume Share)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.brandDistribution} layout="vertical" margin={{left: 30}}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="brand" type="category" width={100} tick={{fontSize: 11}} interval={0} />
                      <Tooltip formatter={(val: number) => fmtNum(val) + " pcs"} cursor={{fill: 'transparent'}} />
                      <Bar dataKey="salesCount" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                        {filteredData.brandDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Row 2: Daily Trend & Seasonality */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Daily Trend */}
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  每日銷售趨勢 (Daily Trend)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} />
                      <YAxis stroke="#64748b" tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip formatter={(val: number) => fmt(val)} />
                      <Bar dataKey="revenue" fill="#6366f1" name="當日營收" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Seasonality */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6">月度銷售趨勢</h3>
                <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={filteredData.seasonality}>
                       <defs>
                         <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                           <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="month" stroke="#64748b" />
                       <YAxis stroke="#64748b" tickFormatter={(val) => `${val/1000}k`} />
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <Tooltip formatter={(val: number) => fmt(val)} />
                       <Area type="monotone" dataKey="revenue" name="總營收" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                     </AreaChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Row 3: Pareto & Price Bands */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pareto Chart */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6 flex justify-between">
                  <span>ABC 貢獻度分析 (Pareto)</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">80/20 法則</span>
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData.performanceMetrics.slice(0, 20)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="productName" tick={false} />
                      <YAxis yAxisId="left" orientation="left" stroke="#64748b" />
                      <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" domain={[0, 100]} unit="%" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="totalAmount" name="營收 (Revenue)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="cumulativeShare" name="累積佔比 %" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

               {/* Price Bands */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6">價格帶成交結構</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.priceBands} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="range" type="category" width={120} tick={{fontSize: 12}} />
                        <Tooltip cursor={{fill: 'transparent'}} formatter={(val: number) => fmt(val)} />
                        <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                        {filteredData.priceBands.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5'][index % 5]} />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>
            </div>
          </div>
        )}

        {/* === TAB: MATRIX === */}
        {activeTab === 'matrix' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800">商品定位矩陣 (Price vs Volume)</h3>
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                   圓圈大小 = 總營收貢獻
                </div>
             </div>
             <div className="h-[500px]">
               <ResponsiveContainer width="100%" height="100%">
                 <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis type="number" dataKey="x" name="平均單價" unit=" TWD" stroke="#94a3b8" label={{ value: '平均單價 (High Price)', position: 'bottom', offset: 0 }} />
                   <YAxis type="number" dataKey="y" name="銷售數量" unit=" pcs" stroke="#94a3b8" label={{ value: '銷售量 (High Vol)', angle: -90, position: 'left' }} />
                   <ZAxis type="number" dataKey="z" range={[50, 400]} />
                   <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
                            <p className="font-bold mb-1">{d.name}</p>
                            <p className="text-gray-600">單價: {fmt(d.x)}</p>
                            <p className="text-gray-600">銷量: {d.y}</p>
                            <p className="text-blue-600 font-medium">營收: {fmt(d.z)}</p>
                            <p className="mt-1 text-xs text-gray-400">Class: {d.abc}</p>
                          </div>
                        );
                      }
                      return null;
                   }} />
                   
                   <Scatter name="A類 (高貢獻)" data={dataA} fill="#10b981" />
                   <Scatter name="B類 (一般)" data={dataB} fill="#f59e0b" />
                   <Scatter name="C類 (長尾)" data={dataC} fill="#ef4444" />
                   
                   <Legend />
                 </ScatterChart>
               </ResponsiveContainer>
             </div>
          </div>
        )}

        {/* === TAB: DETAILS === */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="font-bold text-gray-700">行動建議清單 ({filteredData.decisions.length})</h3>
               <button 
                 onClick={handleExport}
                 className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50 transition-colors shadow-sm font-medium"
               >
                 <Download className="w-4 h-4" /> 匯出 CSV
               </button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                     <th className="px-6 py-4">決策</th>
                     <th className="px-6 py-4">商品名稱</th>
                     <th className="px-6 py-4">分類</th>
                     <th className="px-6 py-4">生命週期</th>
                     <th className="px-6 py-4 w-1/3">理由與行動</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 text-sm">
                   {filteredData.decisions.map((item, idx) => {
                     let tagStyle = 'bg-gray-100 text-gray-700';
                     let Icon = Activity;
                     if (item.tag === DecisionTag.MAIN_STOCK) { tagStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200'; Icon = CheckCircle; }
                     if (item.tag === DecisionTag.STOP_ORDER) { tagStyle = 'bg-red-100 text-red-800 border-red-200'; Icon = PackageMinus; }
                     if (item.tag === DecisionTag.DISPLAY_ONLY) { tagStyle = 'bg-purple-100 text-purple-800 border-purple-200'; Icon = Archive; }
                     if (item.tag === DecisionTag.WATCH_LIST) { tagStyle = 'bg-amber-100 text-amber-800 border-amber-200'; Icon = Eye; }

                     return (
                       <tr key={idx} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${tagStyle}`}>
                             <Icon className="w-3 h-3" />
                             {item.tag.split(' ')[0]}
                           </span>
                         </td>
                         <td className="px-6 py-4 font-bold text-gray-800">
                           {item.productName}
                         </td>
                         <td className="px-6 py-4 text-gray-500">{item.category}</td>
                         <td className="px-6 py-4">
                           <span className={`px-2 py-0.5 rounded text-xs border ${getLifecycleColor(item.lifecycle as LifecycleStage)}`}>
                             {item.lifecycle}
                           </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="mb-1 text-gray-800 font-medium">{item.action}</div>
                           <div className="text-gray-500 text-xs leading-relaxed">{item.reason}</div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AnalysisDashboard;
