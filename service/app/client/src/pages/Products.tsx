import ReactECharts from 'echarts-for-react';
import MetricCard from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import { useQuery } from '@/hooks/useQuery';
import { fetchProducts } from '@/lib/api';
import { formatDollar, formatNumber } from '@/lib/utils';
import { SF_BLUE, SF_DARK, PALETTE } from '@/lib/colors';

export default function Products() {
  const { data, loading } = useQuery(() => fetchProducts(), []);

  if (loading || !data) return <div className="animate-pulse text-gray-400">Loading...</div>;

  const kpis = data.kpis ?? {};
  const topProducts = data.topProducts ?? [];
  const groupsTreemap = data.groupsTreemap ?? [];
  const revenueTrend = data.revenueTrend ?? [];
  const byCountry = data.byCountry ?? [];

  // Top products horizontal bar
  const topBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 20, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value' as const },
    yAxis: { type: 'category' as const, data: topProducts.map((r: any) => r.productName).reverse(), axisLabel: { fontSize: 9 } },
    series: [{ type: 'bar', data: topProducts.map((r: any) => Number(r.revenue)).reverse(), itemStyle: { color: SF_BLUE, borderRadius: [0, 4, 4, 0] } }],
  };

  // Treemap
  const treemapOption = {
    tooltip: { formatter: (p: any) => `${p.name}: ${formatDollar(p.value)}` },
    series: [{
      type: 'treemap',
      roam: false,
      data: groupsTreemap.map((g: any, i: number) => ({
        name: g.groupName,
        value: Number(g.revenue),
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
      label: { show: true, fontSize: 11 },
      breadcrumb: { show: false },
    }],
  };

  // Revenue trend — Theme River (stream chart) — more illustrative than multi-line
  // Builds [date, value, name] tuples expected by ECharts themeRiver
  const riverData = revenueTrend
    .filter((r: any) => r.product && r.qtr && r.revenue !== null)
    .map((r: any) => [r.qtr.substring(0, 10), Number(r.revenue), r.product]);

  const trendOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,0,0,0.2)', width: 1, type: 'solid' } },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const sorted = [...params].sort((a, b) => Number(b.value[1]) - Number(a.value[1]));
        const date = sorted[0]?.value?.[0]?.substring(0, 7) ?? '';
        const lines = sorted
          .filter((p) => Number(p.value[1]) > 0)
          .map((p) => `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.value[2]}</span>
              <strong>${formatDollar(Number(p.value[1]))}</strong>
            </div>`)
          .join('');
        return `<div style="font-weight:600;margin-bottom:6px">${date}</div>${lines}`;
      },
    },
    legend: {
      top: 0,
      type: 'scroll' as const,
      textStyle: { fontSize: 10 },
      data: [...new Set(revenueTrend.map((r: any) => r.product))].slice(0, 8),
    },
    singleAxis: {
      top: 50,
      bottom: 30,
      axisTick: {},
      axisLabel: { fontSize: 10 },
      type: 'time' as const,
      axisPointer: { animation: true, label: { show: true } },
      splitLine: { show: true, lineStyle: { type: 'dashed' as const, opacity: 0.2 } },
    },
    series: [{
      type: 'themeRiver' as const,
      emphasis: {
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)' },
      },
      data: riverData,
      label: { show: false },
      color: PALETTE,
    }],
  };

  // By country choropleth simplified as bar
  const countryBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 10, right: 20, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value' as const },
    yAxis: { type: 'category' as const, data: byCountry.slice(0, 20).map((r: any) => r.country).reverse(), axisLabel: { fontSize: 10 } },
    series: [{ type: 'bar', data: byCountry.slice(0, 20).map((r: any) => Number(r.productCount)).reverse(), itemStyle: { color: SF_DARK } }],
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <MetricCard title="Products" value={formatNumber(Number(kpis.products))} />
        <MetricCard title="Product Groups" value={formatNumber(Number(kpis.productGroups))} />
        <MetricCard title="Total Revenue" value={formatDollar(Number(kpis.totalRevenue))} />
        <MetricCard title="Orders" value={formatNumber(Number(kpis.orders))} />
        <MetricCard title="Avg Item Value" value={formatDollar(Number(kpis.avgItemValue))} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Top 20 Products by Revenue">
          <ReactECharts option={topBarOption} style={{ height: 450 }} />
        </ChartCard>
        <ChartCard title="Revenue by Product Group (Treemap)">
          <ReactECharts option={treemapOption} style={{ height: 450 }} />
        </ChartCard>
      </div>

      <ChartCard title="Revenue Flow Across Top Products (Quarterly)">
        <ReactECharts option={trendOption} style={{ height: 420 }} />
      </ChartCard>

      <ChartCard title="Products by Country">
        <ReactECharts option={countryBarOption} style={{ height: 400 }} />
      </ChartCard>
    </div>
  );
}
