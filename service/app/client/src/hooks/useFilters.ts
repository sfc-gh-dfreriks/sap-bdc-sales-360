import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchCustomers } from '@/lib/api';

// SAP SE is the demo tenant's own company and dominates the opportunity data, so it is excluded by default.
export const DEFAULT_EXCLUDE = ['SAP SE'];

interface FilterContextType {
  customers: string[];
  includeCustomers: string[];
  setIncludeCustomers: (v: string[]) => void;
  excludeCustomers: string[];
  setExcludeCustomers: (v: string[]) => void;
  loading: boolean;
}

const FilterContext = createContext<FilterContextType>({
  customers: [],
  includeCustomers: [],
  setIncludeCustomers: () => {},
  excludeCustomers: DEFAULT_EXCLUDE,
  setExcludeCustomers: () => {},
  loading: true,
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<string[]>([]);
  const [includeCustomers, setIncludeCustomers] = useState<string[]>([]);
  const [excludeCustomers, setExcludeCustomers] = useState<string[]>(DEFAULT_EXCLUDE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers()
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return React.createElement(
    FilterContext.Provider,
    {
      value: {
        customers,
        includeCustomers,
        setIncludeCustomers,
        excludeCustomers,
        setExcludeCustomers,
        loading,
      },
    },
    children
  );
}

export function useFilters() {
  return useContext(FilterContext);
}
