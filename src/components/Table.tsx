export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="erp-card overflow-x-auto">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-line bg-panel/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-line px-4 py-3 align-top text-ink/80">{children}</td>;
}
