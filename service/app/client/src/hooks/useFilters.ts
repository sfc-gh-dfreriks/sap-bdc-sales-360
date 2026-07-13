import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchCustomers } from '@/lib/api';

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
  excludeCustomers: [],
  setExcludeCustomers: () => {},
  loading: true,
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<string[]>([]);
  const [includeCustomers, setIncludeCustomers] = useState<string[]>([]);
  const [excludeCustomers, setExcludeCustomers] = useState<string[]>([]);
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
