import { useState } from 'react';
import {
  LayoutDashboard,
  Filter,
  HeartPulse,
  Package,
  Trophy,
  TrendingUp,
  MessageSquare,
  Check,
  Search,
  X,
} from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { cn } from '@/lib/utils';

export type PageId =
  | 'dashboard'
  | 'funnel'
  | 'health'
  | 'products'
  | 'leaderboard'
  | 'forecast'
  | 'chat';

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ElementType;
  hasFilters?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hasFilters: true },
  { id: 'funnel', label: 'Sales Funnel', icon: Filter, hasFilters: true },
  { id: 'health', label: 'Customer Health', icon: HeartPulse, hasFilters: true },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'leaderboard', label: 'Rep Leaderboard', icon: Trophy },
  { id: 'forecast', label: 'Sales Forecast', icon: TrendingUp },
  { id: 'chat', label: 'Ask the Agent', icon: MessageSquare },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const {
    customers,
    includeCustomers,
    setIncludeCustomers,
    excludeCustomers,
    setExcludeCustomers,
  } = useFilters();

  const [includeSearch, setIncludeSearch] = useState('');
  const [excludeSearch, setExcludeSearch] = useState('');

  const filteredInclude = includeSearch.trim()
    ? customers.filter((c) => c.toLowerCase().includes(includeSearch.toLowerCase()))
    : customers;
  const filteredExclude = excludeSearch.trim()
    ? customers.filter((c) => c.toLowerCase().includes(excludeSearch.toLowerCase()))
    : customers;

  // Show selected first when no search, then search results
  const includeList = includeSearch.trim()
    ? filteredInclude.slice(0, 100)
    : [
        ...includeCustomers,
        ...customers.filter((c) => !includeCustomers.includes(c)).slice(0, 30 - includeCustomers.length),
      ];
  const excludeList = excludeSearch.trim()
    ? filteredExclude.slice(0, 100)
    : [
        ...excludeCustomers,
        ...customers.filter((c) => !excludeCustomers.includes(c)).slice(0, 30 - excludeCustomers.length),
      ];

  const activeNav = NAV_ITEMS.find((n) => n.id === activePage);
  const showFilters = activeNav?.hasFilters ?? false;

  function toggleItem(item: string, selected: string[], setSelected: (v: string[]) => void) {
    if (selected.includes(item)) {
      setSelected(selected.filter((s) => s !== item));
    } else {
      setSelected([...selected, item]);
    }
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-gradient-to-b from-sf-navy to-sf-dark text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <img src="/snowflake_logo.svg" alt="Snowflake" className="h-7 w-auto" />
        <span className="text-lg font-bold tracking-tight text-white">
          SAP Sales 360
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-sf-blue/20 text-sf-pale font-medium'
                      : 'text-sf-pale/80 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Customer Filters */}
      {showFilters && (
        <>
          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sf-pale/70">
                Include Customers
                {includeCustomers.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-sf-blue/30 px-1.5 py-0.5 text-[9px] text-white">
                    {includeCustomers.length}
                  </span>
                )}
              </span>
              {includeCustomers.length > 0 && (
                <button onClick={() => setIncludeCustomers([])} className="text-[10px] text-sf-pale hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-sf-pale/50" />
              <input
                type="text"
                value={includeSearch}
                onChange={(e) => setIncludeSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-white/10 bg-white/5 py-1 pl-7 pr-7 text-xs text-sf-pale placeholder:text-sf-pale/40 outline-none focus:border-sf-blue/60 focus:bg-white/10"
              />
              {includeSearch && (
                <button
                  onClick={() => setIncludeSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-sf-pale/60 hover:bg-white/10 hover:text-sf-pale"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {includeList.length === 0 ? (
                <p className="px-2 py-2 text-[10px] italic text-sf-pale/40">No matches</p>
              ) : (
                includeList.map((name) => {
                  const checked = includeCustomers.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleItem(name, includeCustomers, setIncludeCustomers)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-sf-pale/80 hover:bg-white/5"
                    >
                      <span className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                        checked ? 'border-sf-blue bg-sf-blue' : 'border-sf-pale/40'
                      )}>
                        {checked && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="truncate">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sf-pale/70">
                Exclude Customers
                {excludeCustomers.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-sf-accent/30 px-1.5 py-0.5 text-[9px] text-white">
                    {excludeCustomers.length}
                  </span>
                )}
              </span>
              {excludeCustomers.length > 0 && (
                <button onClick={() => setExcludeCustomers([])} className="text-[10px] text-sf-pale hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-sf-pale/50" />
              <input
                type="text"
                value={excludeSearch}
                onChange={(e) => setExcludeSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-white/10 bg-white/5 py-1 pl-7 pr-7 text-xs text-sf-pale placeholder:text-sf-pale/40 outline-none focus:border-sf-accent/60 focus:bg-white/10"
              />
              {excludeSearch && (
                <button
                  onClick={() => setExcludeSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-sf-pale/60 hover:bg-white/10 hover:text-sf-pale"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {excludeList.length === 0 ? (
                <p className="px-2 py-2 text-[10px] italic text-sf-pale/40">No matches</p>
              ) : (
                excludeList.map((name) => {
                  const checked = excludeCustomers.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleItem(name, excludeCustomers, setExcludeCustomers)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-sf-pale/80 hover:bg-white/5"
                    >
                      <span className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                        checked ? 'border-sf-accent bg-sf-accent' : 'border-sf-pale/40'
                      )}>
                        {checked && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="truncate">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[10px] leading-relaxed text-sf-pale/50">
          Data: SAP_SALES_360.SALES_360_L2
        </p>
        <p className="text-[10px] leading-relaxed text-sf-pale/50">
          Agent: SAP_SALES_360.SEMANTIC.SAP_SALES_360_AGENT
        </p>
        <p className="mt-1 text-[10px] text-sf-pale/40">Snowflake Intelligence</p>
      </div>
    </aside>
  );
}
