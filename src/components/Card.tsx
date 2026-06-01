export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`erp-card p-5 ${className}`}>{children}</div>;
}

export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
    </Card>
  );
}
