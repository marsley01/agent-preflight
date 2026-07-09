export default function SettingsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-white mb-2">Settings</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">Configure scan preferences</p>
      <div className="card p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-white block mb-1">Project Path</label>
          <input
            type="text"
            defaultValue="."
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-muted)] mt-1">Path to the project to scan</p>
        </div>
      </div>
    </div>
  );
}
