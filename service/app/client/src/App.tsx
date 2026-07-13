import { useState } from 'react';
import { FilterProvider } from '@/hooks/useFilters';
import Sidebar, { NAV_ITEMS, type PageId } from '@/components/Sidebar';
import Dashboard from '@/pages/Dashboard';
import Funnel from '@/pages/Funnel';
import Health from '@/pages/Health';
import Products from '@/pages/Products';
import Leaderboard from '@/pages/Leaderboard';
import Forecast from '@/pages/Forecast';
import Chat from '@/pages/Chat';

const PAGE_COMPONENTS: Record<string, React.FC> = {
  dashboard: Dashboard,
  funnel: Funnel,
  health: Health,
  products: Products,
  leaderboard: Leaderboard,
  forecast: Forecast,
  chat: Chat,
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
