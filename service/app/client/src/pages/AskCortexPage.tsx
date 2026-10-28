import AskCortex from '@/components/AskCortex';

const SUGGESTIONS = [
  'How is overall sales performance trending and what stands out?',
  'Which customers drive the most revenue, and how concentrated is it?',
  'Where is the pipeline at risk — which stages or stale deals?',
  'Which products and product groups are growing or declining?',
  'Which regions and reps are ahead of or behind quota?',
  'How are actuals tracking against the sales forecast?',
];

export default function AskCortexPage() {
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-gray-600">
        Ask Cortex analyses live facts gathered from SAP_SALES_360 — sales orders, customers, products, CRM pipeline,
        rep quotas and forecasts — and explains them in plain language. Pick a suggested question or type your own.
      </p>
      <AskCortex topic="general" label="Analyse overall sales performance" suggestions={SUGGESTIONS} />
    </div>
  );
}
