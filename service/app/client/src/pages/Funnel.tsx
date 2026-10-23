import ReactECharts from '@/components/Chart';
import MetricCard from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import { useQuery } from '@/hooks/useQuery';
import { useFilters } from '@/hooks/useFilters';
import { fetchFunnel } from '@/lib/api';
import { formatDollar, formatNumber } from '@/lib/utils';
import { SF_BLUE, SF_DARK, SF_NAVY, SF_ACCENT, PALETTE, STAGE_COLORS } from '@/lib/colors';

export default function Funnel() {
  const { includeCustomers, excludeCustomers } = useFilters();
  const { data, loading } = useQuery(
    () => fetchFunnel(includeCustomers, excludeCustomers),
    [includeCustomers, excludeCustomers]
  );

  if (loading || !data) return <div className="animate-pulse text-gray-400">Loading...</div>;

  const kpis = data.kpis ?? {};
  const stages = data.stages ?? [];
  const sankey = data.sankey ?? [];
  const winLoss = data.winLossBySource ?? [];
  const aging = data.aging ?? [];
  const staleDeals = data.staleDeals ?? [];

  // Funnel chart: each stage labelled with its value and share of total deal value
  const funnelTotal = stages.reduce((t: number, s: any) => t + Number(s.sumAmount || 0), 0);
  const pctOf = (v: number) => (funnelTotal ? `${((v / funnelTotal) * 100).toFixed(1)}%` : '0%');
  const funnelOption = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br>${formatDollar(p.value)} · ${pctOf(p.value)} of total<br>${formatNumber(p.data.count)} deals` },
    series: [{
      type: 'funnel',
      left: '10%', right: '10%', top: 20, bottom: 20,
      sort: 'none',
      gap: 2,
      label: {
        show: true, position: 'inside', fontSize: 11, color: '#fff', fontWeight: 'bold' as const,
        formatter: (p: any) => `${p.name}\n${formatDollar(p.value)} · ${pctOf(p.value)}`,
      },
      data: stages.map((s: any) => ({
        name: s.stage, value: Number(s.sumAmount), count: Number(s.count),
        itemStyle: { color: STAGE_COLORS[s.stage] ?? SF_BLUE },
      })),
    }],
  };

  // Sankey
  const leadSources = [...new Set(sankey.map((r: any) => r.leadSource))].filter(Boolean);
  const types = [...new Set(sankey.map((r: any) => r.type))].filter(Boolean);
  const outcomes = ['Open', 'Closed Won', 'Closed Lost'];
  const allNodes = [...leadSources, ...types, ...outcomes];

  const sankeyLinks: any[] = [];
  // Lead Source → Type
  const srcToType: Record<string, Record<string, number>> = {};
  for (const r of sankey) {
    if (!r.leadSource || !r.type) continue;
    if (!srcToType[r.leadSource]) srcToType[r.leadSource] = {};
    srcToType[r.leadSource][r.type] = (srcToType[r.leadSource][r.type] || 0) + Number(r.amount);
  }
  for (const [src, targets] of Object.entries(srcToType)) {
    for (const [tgt, val] of Object.entries(targets)) {
      sankeyLinks.push({ source: src, target: tgt, value: val });
    }
  }
  // Type → Outcome
  const typeToOutcome: Record<string, Record<string, number>> = {};
  for (const r of sankey) {
    if (!r.type || !r.outcome) continue;
    if (!typeToOutcome[r.type]) typeToOutcome[r.type] = {};
    typeToOutcome[r.type][r.outcome] = (typeToOutcome[r.type][r.outcome] || 0) + Number(r.amount);
  }
  for (const [src, targets] of Object.entries(typeToOutcome)) {
    for (const [tgt, val] of Object.entries(targets)) {
      sankeyLinks.push({ source: src, target: tgt, value: val });
    }
  }

  const sankeyOption = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: allNodes.map((n) => ({ name: n })),
      links: sankeyLinks,
      lineStyle: { color: 'gradient', curveness: 0.5 },
    }],
  };

  // Win/Loss by source
  const winLossOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Won', 'Lost'] },
    grid: { left: 10, right: 20, top: 40, bottom: 10, containLabel: true },
    yAxis: { type: 'category' as const, data: winLoss.map((r: any) => r.leadSource), axisLabel: { fontSize: 10 } },
    xAxis: { type: 'value' as const },
    series: [
      { name: 'Won', type: 'bar', data: winLoss.map((r: any) => Number(r.wonAmount)), itemStyle: { color: '#59A14F' } },
      { name: 'Lost', type: 'bar', data: winLoss.map((r: any) => Number(r.lostAmount)), itemStyle: { color: SF_ACCENT } },
    ],
  };

  // Bubble scatter - deal aging
  const agingStages = [...new Set(aging.map((a: any) => a.stage))] as string[];
  const scatterOption = {
    tooltip: {
      formatter: (p: any) => `${p.data[3]}<br>Days: ${p.data[0]}<br>Amount: ${formatDollar(p.data[1])}`,
    },
    legend: { top: 0, type: 'scroll' as const },
    xAxis: { name: 'Days Open (from last data update)', nameLocation: 'middle' as const, nameGap: 28, type: 'value' as const, min: 0 },
    yAxis: { name: 'Amount ($)', type: 'value' as const, axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: agingStages.map((stage, i) => ({
      name: stage,
      type: 'scatter',
      symbolSize: (d: number[]) => Math.min(30, Math.max(5, d[1] / 80000)),
      itemStyle: { color: PALETTE[i % PALETTE.length], opacity: 0.6 },
      data: aging
        // All open deals: the API sorts oldest-first, so a top-N slice showed only the oldest deals.
        .filter((a: any) => a.stage === stage)
        .map((a: any) => [Number(a.daysOpen), Number(a.amount), Number(a.daysSinceUpdate), a.name]),
    })),
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Total Deals" value={formatNumber(Number(kpis.totalDeals))} />
        <MetricCard title="Open Pipeline" value={formatDollar(Number(kpis.openPipeline))} />
        <MetricCard title="Won Value" value={formatDollar(Number(kpis.wonValue))} />
        <MetricCard title="Lost Value" value={formatDollar(Number(kpis.lostValue))} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Avg Deal Size" value={formatDollar(Number(kpis.avgDealSize))} />
        <MetricCard title="Avg Days Open" value={formatNumber(Math.round(Number(kpis.avgDaysOpen)))} />
        <MetricCard title="Stale Deals" value={formatNumber(Number(kpis.staleCount))} delta={`${formatDollar(Number(kpis.staleAmount))} at risk`} deltaType="negative" />
        <MetricCard title="Oldest (days)" value={formatNumber(Number(kpis.oldestDays))} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Sales Funnel">
          <ReactECharts option={funnelOption} style={{ height: 380 }} />
        </ChartCard>
        <ChartCard title="Lead Source → Type → Outcome">
          <ReactECharts option={sankeyOption} style={{ height: 380 }} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Win/Loss by Source">
          <ReactECharts option={winLossOption} style={{ height: 350 }} />
        </ChartCard>
        <ChartCard title={`Deal Aging (Bubble) · days open as of ${kpis.asOfDate ?? 'last data update'}`}>
          <ReactECharts option={scatterOption} style={{ height: 350 }} />
        </ChartCard>
      </div>

      {/* Stale deals table */}
      <ChartCard title={`Stale Deals · open 180+ days with no update in 10+ days (as of ${kpis.asOfDate ?? 'last data update'})`}>
        <DataTable
          columns={[
            { key: 'customer', label: 'Customer' },
            { key: 'name', label: 'Deal' },
            { key: 'stage', label: 'Stage' },
            { key: 'amount', label: 'Amount', format: (v) => formatDollar(v) },
            { key: 'rep', label: 'Rep' },
            { key: 'daysOpen', label: 'Days Open' },
            { key: 'probability', label: 'Prob.', format: (v) => `${v}%` },
            { key: 'daysSinceUpdate', label: 'Days Since Update' },
          ]}
          data={staleDeals}
        />
      </ChartCard>
    </div>
  );
}
