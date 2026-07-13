import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
}

export default function MetricCard({ title, value, icon: Icon, className, delta, deltaType }: MetricCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-5 shadow-sm transition-transform hover:scale-[1.02]',
        'border-sf-blue/30 bg-gradient-to-br from-blue-50 to-sky-50',
        className
      )}
    >
      {Icon && (
        <div className="absolute -right-2 -top-2 opacity-10">
          <Icon className="h-16 w-16" />
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <p className="mt-1.5 text-3xl font-extrabold text-gray-900">{value}</p>
      {delta && (
        <p className={cn(
          'mt-1 text-xs font-semibold',
          deltaType === 'positive' ? 'text-emerald-600' : deltaType === 'negative' ? 'text-red-600' : 'text-gray-500'
        )}>
          {delta}
        </p>
      )}
    </div>
  );
}
