export default function ScansPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-white mb-2">Scans</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">Scan history and results</p>
      <div className="card p-12 text-center">
        <p className="text-sm text-[var(--color-muted)]">No scans yet. Run a scan from the dashboard.</p>
      </div>
    </div>
  );
}