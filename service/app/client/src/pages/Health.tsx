import ReactECharts from 'echarts-for-react';
import MetricCard from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchCustomerHealth } from '@/lib/api';
import { formatDollar, formatNumber } from '@/lib/utils';
import { SF_BLUE, SF_DARK, SF_ACCENT, PALETTE } from '@/lib/colors';
import { useState } from 'react';

const HEALTH_STATUSES = ['Healthy', 'No Pipeline', 'No Opportunities', 'All Lost', 'More Lost than Open'];

export default function Health() {
  const { includeCustomers, excludeCustomers } = useFilters();
  const { data, loading } = useQuery(
    () => fetchCustomerHealth(includeCustomers, excludeCustomers),
    [includeCustomers, excludeCustomers]
  );
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  if (loading || !data) return <div className="animate-pulse text-gray-400">Loading...</div>;

  const kpis = data.kpis ?? {};
  const customers = data.customers ?? [];
  const revenueTrend = data.revenueTrend ?? [];
  const openOpps = data.openOpps ?? [];

  // Multi-line revenue trend
  const custNames = [...new Set(revenueTrend.map((r: any) => r.customer))] as string[];
  const quarters = [...new Set(revenueTrend.map((r: any) => r.qtr))] as string[];
  quarters.sort();
  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, type: 'scroll' as const, textStyle: { fontSize: 10 } },
    grid: { left: 50, right: 20, top: 40, bottom: 50, containLabel: true },
    xAxis: { type: 'category' as const, data: quarters.map((q: string) => q?.substring(0, 7)), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatDollar(v) } },
    series: custNames.map((name, i) => ({
      name, type: 'line', smooth: true, symbolSize: 4,
      lineStyle: { width: 2 },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      data: quarters.map((q) => {
        const row = revenueTrend.find((r: any) => r.customer === name && r.qtr === q);
        return row ? Number(row.revenue) : null;
      }),
    })),
  };

  // Customer risk horizontal bar
  const statusCounts = HEALTH_STATUSES.map((s) => ({
    name: s,
    count: customers.filter((c: any) => c.healthStatus === s).length,
  }));
  const riskBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 10, right: 20, top: 10, bottom: 10, containLabel: true },
    yAxis: { type: 'category' as const, data: statusCounts.map((s) => s.name), axisLabel: { fontSize: 11 } },
    xAxis: { type: 'value' as const },
    series: [{
      type: 'bar',
      data: statusCounts.map((s, i) => ({
        value: s.count,
        itemStyle: { color: i === 0 ? '#59A14F' : i < 3 ? '#F28E2B' : SF_ACCENT },
      })),
    }],
  };

  const filteredCustomers = statusFilter.length
    ? customers.filter((c: any) => statusFilter.includes(c.healthStatus))
    : customers;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard title="Total Customers" value={formatNumber(kpis.total)} />
        <MetricCard title="Healthy" value={formatNumber(kpis.healthy)} />
        <MetricCard title="Warning" value={formatNumber(kpis.warning)} />
        <MetricCard title="At Risk" value={formatNumber(kpis.atRisk)} />
        <MetricCard title="Open Pipeline" value={formatDollar(Number(kpis.openPipeline))} />
      </div>

      {/* Revenue trend */}
      <ChartCard title="Top 10 Customer Revenue Trend (Quarterly)">
        <ReactECharts option={trendOption} style={{ height: 350 }} />
      </ChartCard>

      {/* Risk + Opps */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Customer Health Distribution">
          <ReactECharts option={riskBarOption} style={{ height: 280 }} />
        </ChartCard>
        <ChartCard title="Top Open Opportunities">
          <DataTable
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'stage', label: 'Stage' },
              { key: 'amount', label: 'Amount', format: (v) => formatDollar(v) },
              { key: 'probability', label: 'Prob %' },
              { key: 'rep', label: 'Rep' },
            ]}
            data={openOpps}
            maxRows={15}
          />
        </ChartCard>
      </div>

      {/* Filter chips + Detail table */}
      <ChartCard title="Customer Health Detail">
        <div className="mb-4 flex flex-wrap gap-2">
          {HEALTH_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                statusFilter.includes(s)
                  ? 'bg-sf-blue text-white border-sf-blue'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-sf-blue'
              }`}
            >
              {s}
            </button>
          ))}
          {statusFilter.length > 0 && (
            <button onClick={() => setStatusFilter([])} className="text-xs text-gray-400 hover:text-gray-600">
              Clear
            </button>
          )}
        </div>
        <DataTable
          columns={[
            { key: 'customerName', label: 'Customer' },
            { key: 'revenue', label: 'Revenue', format: (v) => formatDollar(v) },
            { key: 'totalOpps', label: 'Opps' },
            { key: 'wonOpps', label: 'Won' },
            { key: 'openOpps', label: 'Open' },
            { key: 'lostOpps', label: 'Lost' },
            { key: 'healthStatus', label: 'Status' },
          ]}
          data={filteredCustomers}
          maxRows={50}
        />
      </ChartCard>
    </div>
  );
}
