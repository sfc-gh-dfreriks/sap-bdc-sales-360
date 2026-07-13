import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import MetricCard from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchDashboard } from '@/lib/api';
import { formatDollar, formatNumber, formatPct } from '@/lib/utils';
import { SF_BLUE, SF_DARK, SF_NAVY, PALETTE, STAGE_COLORS } from '@/lib/colors';
import { DollarSign, ShoppingCart, Users, Target, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { includeCustomers, excludeCustomers } = useFilters();
  const { data, loading } = useQuery(
    () => fetchDashboard(includeCustomers, excludeCustomers),
    [includeCustomers, excludeCustomers]
  );

  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if ((echarts as any).getMap?.('world')) {
      setMapReady(true);
      return;
    }
    // Direct GeoJSON (no topojson dep required) — country names match `name` field
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
      .then((r) => r.json())
      .then((geo) => {
        if (!cancelled) {
          echarts.registerMap('world', geo as any);
          setMapReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setMapReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading || !data) return <div className="animate-pulse text-gray-400">Loading...</div>;

  const kpis = data.kpis ?? {};
  const topCustomers = data.topCustomers ?? [];
  const pipelineByStage = data.pipelineByStage ?? [];
  const salesByCountry = data.salesByCountry ?? [];
  const topReps = data.topReps ?? [];
  const revenueTrend = data.revenueTrend ?? [];
  const forecast = data.forecast ?? {};

  // Choropleth option
  const mapOption: any = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: ${formatDollar(p.value)}` },
    visualMap: {
      min: 0,
      max: Math.max(...salesByCountry.map((r: any) => Number(r.revenue) || 0), 1),
      inRange: { color: ['#E0F2FE', '#29B5E8', '#11567F', '#003860'] },
      show: false,
    },
    series: [{
      type: 'map',
      map: 'world',
      roam: true,
      emphasis: { label: { show: true } },
      data: salesByCountry.map((r: any) => ({ name: countryName(r.country), value: Number(r.revenue) || 0 })),
    }],
  };

  // Fallback bar chart (if map fails to load)
  const sortedCountries = [...salesByCountry].sort((a: any, b: any) => Number(b.revenue) - Number(a.revenue)).slice(0, 12);
  const countryBarOption: any = {
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}: ${formatDollar(p[0].value)}` },
    grid: { left: 10, right: 30, top: 20, bottom: 30, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
    yAxis: {
      type: 'category',
      data: sortedCountries.map((r: any) => countryName(r.country)).reverse(),
      axisLabel: { fontSize: 10 },
    },
    series: [{
      type: 'bar',
      data: sortedCountries.map((r: any) => Number(r.revenue) || 0).reverse(),
      itemStyle: { color: SF_BLUE, borderRadius: [0, 4, 4, 0] },
    }],
  };

  // Stacked horizontal bar
  const customerNames = [...new Set(pipelineByStage.map((r: any) => r.customerName))] as string[];
  const stages = [...new Set(pipelineByStage.map((r: any) => r.stageName))] as string[];
  const stackedBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, type: 'scroll' as const, textStyle: { fontSize: 10 } },
    grid: { left: 10, right: 20, top: 40, bottom: 10, containLabel: true },
    xAxis: { type: 'value' as const },
    yAxis: { type: 'category' as const, data: customerNames, axisLabel: { fontSize: 10 } },
    series: stages.map((stage) => ({
      name: stage,
      type: 'bar',
      stack: 'total',
      itemStyle: { color: STAGE_COLORS[stage] ?? SF_BLUE },
      data: customerNames.map((c) => {
        const row = pipelineByStage.find((r: any) => r.customerName === c && r.stageName === stage);
        return row ? Number(row.pipelineValue) : 0;
      }),
    })),
  };

  // Top customers bar
  const topCustBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 20, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value' as const },
    yAxis: { type: 'category' as const, data: topCustomers.map((r: any) => r.customer).reverse(), axisLabel: { fontSize: 10 } },
    series: [{ type: 'bar', data: topCustomers.map((r: any) => Number(r.revenue)).reverse(), itemStyle: { color: SF_BLUE, borderRadius: [0, 4, 4, 0] } }],
  };

  // Revenue trend with ML forecast
  const history = forecast.history ?? [];
  const predictions = forecast.predictions ?? [];
  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Actual', 'Forecast', 'Confidence'] },
    grid: { left: 50, right: 20, top: 40, bottom: 50, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: [...history.map((r: any) => r.month?.substring(0, 7)), ...predictions.map((r: any) => r.month?.substring(0, 7))],
      axisLabel: { fontSize: 10, rotate: 30 },
    },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: [
      {
        name: 'Actual', type: 'line', smooth: true,
        data: [...history.map((r: any) => Number(r.revenue)), ...predictions.map(() => null)],
        lineStyle: { width: 3, color: SF_BLUE }, itemStyle: { color: SF_BLUE },
      },
      {
        name: 'Forecast', type: 'line', smooth: true,
        data: [...history.map(() => null), ...predictions.map((r: any) => Number(r.forecast))],
        lineStyle: { width: 2, color: SF_DARK, type: 'dashed' }, itemStyle: { color: SF_DARK },
      },
      {
        name: 'Confidence', type: 'line', smooth: true, stack: 'band',
        data: [...history.map(() => null), ...predictions.map((r: any) => Number(r.lower))],
        lineStyle: { width: 0 }, itemStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' },
      },
      {
        name: 'Upper', type: 'line', smooth: true, stack: 'band',
        data: [...history.map(() => null), ...predictions.map((r: any) => Number(r.upper) - Number(r.lower))],
        lineStyle: { width: 0 }, itemStyle: { color: 'transparent' },
        areaStyle: { color: `${SF_DARK}22` },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard title="SAP Revenue" value={formatDollar(Number(kpis.totalRevenue))} icon={DollarSign} />
        <MetricCard title="Sales Orders" value={formatNumber(Number(kpis.totalOrders))} icon={ShoppingCart} />
        <MetricCard title="Customers" value={formatNumber(Number(kpis.totalCustomers))} icon={Users} />
        <MetricCard title="CRM Pipeline" value={formatDollar(Number(kpis.totalPipeline))} icon={Target} />
        <MetricCard title="Win Rate" value={formatPct(Number(kpis.winRate))} icon={TrendingUp} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Sales by Country">
          {!mapReady ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-gray-400">
              Loading map...
            </div>
          ) : (echarts as any).getMap?.('world') ? (
            <ReactECharts option={mapOption} style={{ height: 350 }} />
          ) : (
            <ReactECharts option={countryBarOption} style={{ height: 350 }} />
          )}
        </ChartCard>
        <ChartCard title="Open Pipeline by Customer & Stage (Top 10)">
          <ReactECharts option={stackedBarOption} style={{ height: 350 }} />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Top 10 Customers by Revenue">
          <ReactECharts option={topCustBarOption} style={{ height: 350 }} />
        </ChartCard>
        <ChartCard title="ML Revenue Forecast">
          <ReactECharts option={trendOption} style={{ height: 350 }} />
        </ChartCard>
      </div>

      {/* Rep Table */}
      <ChartCard title="Sales Rep Performance">
        <DataTable
          columns={[
            { key: 'fullName', label: 'Rep' },
            { key: 'region', label: 'Region' },
            { key: 'deals', label: 'Deals', format: (v) => formatNumber(v) },
            { key: 'pipeline', label: 'Pipeline', format: (v) => formatDollar(v) },
            { key: 'won', label: 'Won', format: (v) => formatDollar(v) },
            { key: 'quota', label: 'Quota', format: (v) => formatDollar(v) },
            { key: 'quotaPct', label: 'Attainment', progress: true, progressMax: 200 },
          ]}
          data={topReps}
        />
      </ChartCard>
    </div>
  );
}

function countryName(iso2: string): string {
  const map: Record<string, string> = {
    US: 'United States of America', GB: 'United Kingdom', DE: 'Germany', FR: 'France', JP: 'Japan',
    CN: 'China', IN: 'India', BR: 'Brazil', CA: 'Canada', AU: 'Australia', IT: 'Italy',
    ES: 'Spain', MX: 'Mexico', KR: 'South Korea', NL: 'Netherlands', CH: 'Switzerland',
    SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', AT: 'Austria',
    BE: 'Belgium', IE: 'Ireland', PT: 'Portugal', CZ: 'Czech Republic', RO: 'Romania',
    HU: 'Hungary', GR: 'Greece', IL: 'Israel', TR: 'Turkey', SA: 'Saudi Arabia',
    AE: 'United Arab Emirates', ZA: 'South Africa', NG: 'Nigeria', EG: 'Egypt',
    SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand', ID: 'Indonesia', PH: 'Philippines',
    VN: 'Vietnam', TW: 'Taiwan', HK: 'Hong Kong', NZ: 'New Zealand', AR: 'Argentina',
    CO: 'Colombia', CL: 'Chile', PE: 'Peru', RU: 'Russia', UA: 'Ukraine',
  };
  return map[iso2] ?? iso2;
}
