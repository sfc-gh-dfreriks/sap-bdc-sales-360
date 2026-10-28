import { useState } from 'react';
import { FilterProvider } from '@/hooks/useFilters';
import Sidebar, { NAV_ITEMS, type PageId } from '@/components/Sidebar';
import Dashboard from '@/pages/Dashboard';
import Funnel from '@/pages/Funnel';
import Health from '@/pages/Health';
import Products from '@/pages/Products';
import Leaderboard from '@/pages/Leaderboard';
import Forecast from '@/pages/Forecast';
import Lineage from '@/pages/Lineage';
import AskCortexPage from '@/pages/AskCortexPage';
import AskCortex from '@/components/AskCortex';

// Per-page Ask Cortex topic + suggested questions (topics defined in server/src/routes/askCortex.ts).
const ASK: Partial<Record<PageId, { topic: string; suggestions: string[] }>> = {
  dashboard: { topic: 'dashboard', suggestions: ['Which customers and countries drive most of the revenue?', 'Is revenue trending up or down, and what does the ML forecast imply?'] },
  funnel: { topic: 'funnel', suggestions: ['Which stale deals should reps chase first?', 'Which lead sources have the best and worst win rates?'] },
  health: { topic: 'health', suggestions: ['Which high-revenue customers look at risk?', 'Where is the biggest open pipeline relative to past wins?'] },
  products: { topic: 'products', suggestions: ['Which products and groups drive the most revenue?', 'How concentrated is revenue across the product portfolio?'] },
  leaderboard: { topic: 'leaderboard', suggestions: ['Which reps are behind quota with thin pipeline coverage?', 'How do regions compare on attainment?'] },
  forecast: { topic: 'forecast', suggestions: ['Which product groups are missing plan the most?', 'How do the PLAN, REVISED and STRETCH versions compare to actuals?'] },
};

const PAGE_COMPONENTS: Record<string, React.FC> = {
  ask: AskCortexPage,
  dashboard: Dashboard,
  funnel: Funnel,
  health: Health,
  products: Products,
  leaderboard: Leaderboard,
  forecast: Forecast,
  lineage: Lineage,
};

function AppShell() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  const navItem = NAV_ITEMS.find((n) => n.id === activePage)!;
  const Icon = navItem.icon;
  const PageComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="ml-64 min-h-screen p-6">
        <div className="mb-6 flex items-center gap-3">
          <Icon className="h-6 w-6 text-sf-blue" />
          <h1 className="text-2xl font-bold text-sf-navy">{navItem.label}</h1>
        </div>
        {ASK[activePage] && (
          <div className="mb-6">
            <AskCortex key={activePage} topic={ASK[activePage]!.topic} label={`Ask Cortex about ${navItem.label}`} suggestions={ASK[activePage]!.suggestions} />
          </div>
        )}
        {PageComponent && <PageComponent />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}
