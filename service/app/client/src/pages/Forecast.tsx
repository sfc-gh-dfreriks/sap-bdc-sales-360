import { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import MetricCard from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import { useQuery } from '@/hooks/useQuery';
import { fetchForecast } from '@/lib/api';
import { formatDollar, formatPct } from '@/lib/utils';
import { SF_BLUE, SF_DARK, SF_NAVY, SF_ACCENT, PALETTE } from '@/lib/colors';

export default function Forecast() {
  const [version, setVersion] = useState('PLAN');
  const { data, loading } = useQuery(() => fetchForecast(version), [version]);

  if (loading || !data) return <div className="animate-pulse text-gray-400">Loading...</div>;

  const kpis = data.kpis ?? {};
  const trend = data.trend ?? [];
  const byOrg = data.byOrg ?? [];
  const versionCompare = data.versionCompare ?? [];
  const topCustomers = data.topCustomers ?? [];
  const bottomCustomers = data.bottomCustomers ?? [];
  const territoryHeatmap = data.territoryHeatmap ?? [];
  const productHeatmap = data.productHeatmap ?? [];
  const predictions = data.predictions ?? [];

  // Forecast vs Actual bar
  const fvaOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Forecast', 'Actual'] },
    grid: { left: 50, right: 20, top: 40, bottom: 50, containLabel: true },
    xAxis: { type: 'category' as const, data: trend.map((r: any) => r.month?.substring(0, 7)), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: [
      { name: 'Forecast', type: 'bar', itemStyle: { color: SF_BLUE, opacity: 0.7 }, data: trend.map((r: any) => Number(r.forecast)) },
      { name: 'Actual', type: 'bar', itemStyle: { color: SF_NAVY }, data: trend.map((r: any) => Number(r.actual)) },
    ],
  };

  // Attainment trend with ML projection
  const attainmentValues = trend.map((r: any) => (Number(r.forecast) > 0 ? Number(r.actual) / Number(r.forecast) * 100 : 0));
  const attOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Actual Attainment', 'ML Projection', 'Confidence'] },
    grid: { left: 50, right: 20, top: 40, bottom: 50, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: [...trend.map((r: any) => r.month?.substring(0, 7)), ...predictions.map((r: any) => r.month?.substring(0, 7))],
      axisLabel: { rotate: 30, fontSize: 10 },
    },
    yAxis: { type: 'value' as const, name: 'Attainment %' },
    series: [
      {
        name: 'Actual Attainment', type: 'line', smooth: true,
        data: [...attainmentValues, ...predictions.map(() => null)],
        lineStyle: { width: 3, color: SF_BLUE }, itemStyle: { color: SF_BLUE },
      },
      {
        name: 'ML Projection', type: 'line', smooth: true,
        data: [...trend.map(() => null), ...predictions.map((r: any) => Number(r.forecast))],
        lineStyle: { width: 2, color: SF_DARK, type: 'dashed' }, itemStyle: { color: SF_DARK },
      },
      {
        name: 'Confidence', type: 'line', stack: 'band',
        data: [...trend.map(() => null), ...predictions.map((r: any) => Number(r.lower))],
        lineStyle: { width: 0 }, itemStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' },
      },
      {
        type: 'line', stack: 'band',
        data: [...trend.map(() => null), ...predictions.map((r: any) => Number(r.upper) - Number(r.lower))],
        lineStyle: { width: 0 }, itemStyle: { color: 'transparent' }, areaStyle: { color: `${SF_DARK}22` },
      },
    ],
    markLine: { data: [{ yAxis: 100, label: { formatter: '100% Target' }, lineStyle: { color: SF_ACCENT, type: 'dashed' } }] },
  };

  // By Org dual-axis
  const orgOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Forecast', 'Actual', 'Attainment %'] },
    grid: { left: 50, right: 60, top: 40, bottom: 50, containLabel: true },
    xAxis: { type: 'category' as const, data: byOrg.map((r: any) => r.salesOrg), axisLabel: { rotate: 20, fontSize: 10 } },
    yAxis: [
      { type: 'value' as const, name: 'Amount', axisLabel: { formatter: (v: number) => formatDollar(v) } },
      { type: 'value' as const, name: 'Attainment %', position: 'right' as const },
    ],
    series: [
      { name: 'Forecast', type: 'bar', itemStyle: { color: SF_BLUE, opacity: 0.6 }, data: byOrg.map((r: any) => Number(r.forecast)) },
      { name: 'Actual', type: 'bar', itemStyle: { color: SF_NAVY }, data: byOrg.map((r: any) => Number(r.actual)) },
      { name: 'Attainment %', type: 'scatter', yAxisIndex: 1, symbolSize: 14, symbol: 'diamond', itemStyle: { color: SF_ACCENT }, data: byOrg.map((r: any) => Number(r.attainmentPct)) },
    ],
  };

  // Version comparison
  const years = [...new Set(versionCompare.map((r: any) => String(r.fiscalYear)))].sort();
  const versions = ['PLAN', 'REVISED', 'STRETCH'];
  const vColors: Record<string, string> = { PLAN: SF_BLUE, REVISED: '#0D8ABF', STRETCH: SF_DARK };
  const vcOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30, containLabel: true },
    xAxis: { type: 'category' as const, data: years },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: [
      ...versions.map((v) => ({
        name: `${v} Forecast`, type: 'bar',
        itemStyle: { color: vColors[v], opacity: 0.5 },
        data: years.map((y) => {
          const row = versionCompare.find((r: any) => String(r.fiscalYear) === y && r.version === v);
          return row ? Number(row.forecast) : 0;
        }),
      })),
      {
        name: 'Actual', type: 'bar', itemStyle: { color: '#59A14F' },
        data: years.map((y) => {
          const row = versionCompare.find((r: any) => String(r.fiscalYear) === y);
          return row ? Number(row.actual) : 0;
        }),
      },
    ],
  };

  // Top/bottom attainment horizontal bars
  const topBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 10, right: 60, top: 10, bottom: 10, containLabel: true },
    yAxis: { type: 'category' as const, data: topCustomers.map((r: any) => r.customer), axisLabel: { fontSize: 10 } },
    xAxis: { type: 'value' as const, name: 'Attainment %' },
    series: [{ type: 'bar', data: topCustomers.map((r: any) => ({ value: Number(r.attainmentPct), itemStyle: { color: Number(r.attainmentPct) >= 100 ? '#59A14F' : SF_BLUE } })) }],
    markLine: { data: [{ xAxis: 100 }] },
  };
  const bottomBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 10, right: 60, top: 10, bottom: 10, containLabel: true },
    yAxis: { type: 'category' as const, data: bottomCustomers.map((r: any) => r.customer), axisLabel: { fontSize: 10 } },
    xAxis: { type: 'value' as const, name: 'Attainment %' },
    series: [{ type: 'bar', data: bottomCustomers.map((r: any) => ({ value: Number(r.attainmentPct), itemStyle: { color: Number(r.attainmentPct) < 90 ? SF_ACCENT : '#F28E2B' } })) }],
  };

  // Territory heatmap
  const orgs = [...new Set(territoryHeatmap.map((r: any) => r.salesOrg))] as string[];
  const months = [...new Set(territoryHeatmap.map((r: any) => r.month))] as string[];
  months.sort();
  const terrData: [number, number, number][] = [];
  for (let mi = 0; mi < months.length; mi++) {
    for (let oi = 0; oi < orgs.length; oi++) {
      const row = territoryHeatmap.find((r: any) => r.salesOrg === orgs[oi] && r.month === months[mi]);
      terrData.push([mi, oi, row ? Number(row.attainmentPct) : 0]);
    }
  }
  const terrHeatOption = {
    tooltip: { formatter: (p: any) => `${orgs[p.data[1]]}<br>${months[p.data[0]]?.substring(0, 7)}: ${p.data[2].toFixed(1)}%` },
    grid: { left: 10, right: 80, top: 10, bottom: 50, containLabel: true },
    xAxis: { type: 'category' as const, data: months.map((m) => m?.substring(0, 7)), axisLabel: { rotate: -45, fontSize: 9 } },
    yAxis: { type: 'category' as const, data: orgs, axisLabel: { fontSize: 9 } },
    visualMap: { min: 0, max: 150, calculable: true, orient: 'vertical' as const, right: 0, top: 'center', inRange: { color: ['#E15759', '#F28E2B', '#FFFFBF', '#59A14F', '#1B7837'] } },
    series: [{ type: 'heatmap', data: terrData, label: { show: false } }],
  };

  // Product heatmap
  const pGroups = [...new Set(productHeatmap.map((r: any) => r.productGroup))].filter(Boolean);
  const fYears = [...new Set(productHeatmap.map((r: any) => String(r.fiscalYear)))].sort();
  const prodHeatData: [number, number, number][] = [];
  for (let yi = 0; yi < fYears.length; yi++) {
    for (let gi = 0; gi < pGroups.length; gi++) {
      const row = productHeatmap.find((r: any) => r.productGroup === pGroups[gi] && String(r.fiscalYear) === fYears[yi]);
      prodHeatData.push([yi, gi, row ? Number(row.attainmentPct) : 0]);
    }
  }
  const prodHeatOption = {
    tooltip: { formatter: (p: any) => `${pGroups[p.data[1]]}<br>FY${fYears[p.data[0]]}: ${p.data[2].toFixed(1)}%` },
    grid: { left: 10, right: 80, top: 10, bottom: 30, containLabel: true },
    xAxis: { type: 'category' as const, data: fYears },
    yAxis: { type: 'category' as const, data: pGroups, axisLabel: { fontSize: 9 } },
    visualMap: { min: 0, max: 150, calculable: true, orient: 'vertical' as const, right: 0, top: 'center', inRange: { color: ['#E15759', '#F28E2B', '#FFFFBF', '#59A14F', '#1B7837'] } },
    series: [{ type: 'heatmap', data: prodHeatData, label: { show: false } }],
  };

  return (
    <div className="space-y-6">
      {/* Version selector */}
      <div className="flex gap-3">
        {['PLAN', 'REVISED', 'STRETCH'].map((v) => (
          <button
            key={v}
            onClick={() => setVersion(v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              version === v ? 'bg-sf-blue text-white' : 'bg-white text-gray-600 border border-gray-300 hover:border-sf-blue'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard title={`Forecast (${version})`} value={formatDollar(Number(kpis.forecastAmount))} />
        <MetricCard title="Actual Revenue" value={formatDollar(Number(kpis.actualAmount))} />
        <MetricCard title="Variance" value={formatDollar(Math.abs(Number(kpis.varianceAmount)))}
          delta={Number(kpis.varianceAmount) >= 0 ? 'Over plan' : 'Under plan'}
          deltaType={Number(kpis.varianceAmount) >= 0 ? 'positive' : 'negative'} />
        <MetricCard title="Avg Attainment" value={formatPct(Number(kpis.avgAttainmentPct))} />
        <MetricCard title="Above Plan" value={formatPct(Number(kpis.abovePlanPct))} />
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Forecast vs Actual by Month">
          <ReactECharts option={fvaOption} style={{ height: 350 }} />
        </ChartCard>
        <ChartCard title="Attainment % Trend + ML Projection">
          <ReactECharts option={attOption} style={{ height: 350 }} />
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Performance by Sales Organization">
          <ReactECharts option={orgOption} style={{ height: 350 }} />
        </ChartCard>
        <ChartCard title="Forecast Version Comparison by Year">
          <ReactECharts option={vcOption} style={{ height: 350 }} />
        </ChartCard>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Top 10 — Highest Attainment">
          <ReactECharts option={topBarOption} style={{ height: 350 }} />
        </ChartCard>
        <ChartCard title="Bottom 10 — Lowest Attainment">
          <ReactECharts option={bottomBarOption} style={{ height: 350 }} />
        </ChartCard>
      </div>

      {/* Row 4 — Heatmaps */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Territory Attainment Heatmap">
          <ReactECharts option={terrHeatOption} style={{ height: 350 }} />
        </ChartCard>
        <ChartCard title="Product Group Attainment by Year">
          <ReactECharts option={prodHeatOption} style={{ height: 350 }} />
        </ChartCard>
      </div>
    </div>
  );
}
