import ReactECharts from 'echarts-for-react';
import MetricCard from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import { useQuery } from '@/hooks/useQuery';
import { fetchLeaderboard } from '@/lib/api';
import { formatDollar, formatNumber, formatPct } from '@/lib/utils';
import { SF_BLUE, SF_DARK, SF_ACCENT, PALETTE } from '@/lib/colors';

export default function Leaderboard() {
  const { data, loading } = useQuery(() => fetchLeaderboard(), []);

  if (loading || !data) return <div className="animate-pulse text-gray-400">Loading...</div>;

  const teamKpis = data.teamKpis ?? {};
  const reps = data.reps ?? [];
  const stageBreakdown = data.stageBreakdown ?? [];
  const activities = data.activities ?? [];
  const regions = data.regions ?? [];

  // Attainment stacked bar
  const attainmentOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['Won', 'Pipeline'] },
    grid: { left: 10, right: 60, top: 40, bottom: 10, containLabel: true },
    yAxis: { type: 'category' as const, data: reps.map((r: any) => r.fullName).reverse(), axisLabel: { fontSize: 10 } },
    xAxis: { type: 'value' as const },
    series: [
      { name: 'Won', type: 'bar', stack: 'total', itemStyle: { color: '#59A14F' }, data: reps.map((r: any) => Number(r.won)).reverse() },
      { name: 'Pipeline', type: 'bar', stack: 'total', itemStyle: { color: SF_BLUE }, data: reps.map((r: any) => Number(r.openPipeline)).reverse() },
    ],
  };

  // Heatmap rep × stage
  const repNames = [...new Set(stageBreakdown.map((r: any) => r.rep))];
  const stageNames = [...new Set(stageBreakdown.map((r: any) => r.stage))];
  const heatmapData: [number, number, number][] = [];
  for (let si = 0; si < stageNames.length; si++) {
    for (let ri = 0; ri < repNames.length; ri++) {
      const row = stageBreakdown.find((d: any) => d.rep === repNames[ri] && d.stage === stageNames[si]);
      heatmapData.push([si, ri, row ? Number(row.dealCount) : 0]);
    }
  }
  const heatmapOption = {
    tooltip: { formatter: (p: any) => `${repNames[p.data[1]]}<br>${stageNames[p.data[0]]}: ${p.data[2]} deals` },
    grid: { left: 10, right: 60, top: 10, bottom: 50, containLabel: true },
    xAxis: { type: 'category' as const, data: stageNames, axisLabel: { rotate: -45, fontSize: 9 } },
    yAxis: { type: 'category' as const, data: repNames, axisLabel: { fontSize: 9 } },
    visualMap: { min: 0, max: Math.max(...heatmapData.map((d) => d[2]), 1), inRange: { color: ['#F0F4F8', SF_BLUE] }, show: true, orient: 'vertical' as const, right: 0, top: 'center' },
    series: [{ type: 'heatmap', data: heatmapData, label: { show: true, fontSize: 10 } }],
  };

  // Activity pivot table
  const activityTypes = [...new Set(activities.map((a: any) => a.activityType))] as string[];
  const actRepNames = [...new Set(activities.map((a: any) => a.rep))] as string[];
  const activityPivot = actRepNames.map((rep: string) => {
    const row: Record<string, any> = { rep };
    for (const at of activityTypes) {
      const found = activities.find((a: any) => a.rep === rep && a.activityType === at);
      row[at] = found ? Number(found.activityCount) : 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Closed Won" value={formatDollar(Number(teamKpis.closedWon))} />
        <MetricCard title="Open Pipeline" value={formatDollar(Number(teamKpis.openPipeline))} />
        <MetricCard title="Team Quota" value={formatDollar(Number(teamKpis.teamQuota))} />
        <MetricCard title="Team Attainment" value={formatPct(Number(teamKpis.teamAttainmentPct))} />
      </div>

      <ChartCard title="Quota Attainment by Rep">
        <ReactECharts option={attainmentOption} style={{ height: Math.max(300, reps.length * 40) }} />
      </ChartCard>

      <ChartCard title="Rep Scorecard">
        <DataTable
          columns={[
            { key: 'fullName', label: 'Rep' },
            { key: 'region', label: 'Region' },
            { key: 'won', label: 'Won', format: (v) => formatDollar(v) },
            { key: 'openPipeline', label: 'Pipeline', format: (v) => formatDollar(v) },
            { key: 'quota', label: 'Quota', format: (v) => formatDollar(v) },
            { key: 'quotaPct', label: 'Attainment %', progress: true, progressMax: 200 },
            { key: 'coveragePct', label: 'Coverage %', format: (v) => v != null ? `${Number(v).toFixed(0)}%` : '-' },
          ]}
          data={reps}
        />
      </ChartCard>

      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Open Deals Heatmap (Rep x Stage)">
          <ReactECharts option={heatmapOption} style={{ height: Math.max(300, repNames.length * 35) }} />
        </ChartCard>
        <ChartCard title="Activity Summary by Rep">
          <DataTable
            columns={[
              { key: 'rep', label: 'Rep' },
              ...activityTypes.map((at) => ({ key: at, label: at, format: (v: any) => String(v ?? 0) })),
            ]}
            data={activityPivot}
          />
        </ChartCard>
      </div>

      <ChartCard title="Regional Performance">
        <DataTable
          columns={[
            { key: 'region', label: 'Region' },
            { key: 'repCount', label: 'Reps' },
            { key: 'pipeline', label: 'Pipeline', format: (v) => formatDollar(v) },
            { key: 'won', label: 'Won', format: (v) => formatDollar(v) },
            { key: 'quota', label: 'Quota', format: (v) => formatDollar(v) },
            { key: 'attainmentPct', label: 'Attainment', progress: true, progressMax: 150 },
          ]}
          data={regions}
        />
      </ChartCard>
    </div>
  );
}
