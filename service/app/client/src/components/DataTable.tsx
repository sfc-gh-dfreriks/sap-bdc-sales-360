import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  format?: (v: any) => string;
  progress?: boolean;
  progressMax?: number;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  maxRows?: number;
}

export default function DataTable({ columns, data, maxRows }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  if (!data || data.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">No data available</p>;
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  let sorted = [...data];
  if (sortKey) {
    sorted.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }
  if (maxRows) sorted = sorted.slice(0, maxRows);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-sf-dark text-white">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="cursor-pointer px-4 py-2.5 text-left font-medium select-none whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-sky-50/50'}>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                  {col.progress ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-sf-blue"
                          style={{ width: `${Math.min(100, (Number(row[col.key]) / (col.progressMax ?? 100)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs">{col.format ? col.format(row[col.key]) : `${Number(row[col.key]).toFixed(1)}%`}</span>
                    </div>
                  ) : (
                    col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
