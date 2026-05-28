export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded border border-line bg-white p-4 shadow-soft ${className}`}>{children}</div>;
}

export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-sm text-ink/60">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
    </Card>
  );
}
