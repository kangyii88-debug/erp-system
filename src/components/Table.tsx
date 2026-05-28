export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-line bg-white shadow-soft">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-line bg-panel px-3 py-2 font-semibold text-ink">{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-line px-3 py-2 align-top text-ink/80">{children}</td>;
}
