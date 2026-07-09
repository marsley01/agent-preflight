"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/dashboard/scans", label: "Scans", icon: "○" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar fixed left-0 top-0 h-full w-56 flex flex-col z-50">
      <div className="p-5 border-b border-[var(--color-border)]">
        <Link href="/" className="block">
          <h1 className="text-sm font-semibold tracking-tight">
            <span className="text-[var(--color-accent)]">Agent</span>{" "}
            <span className="text-white">Preflight</span>
          </h1>
        </Link>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">Dashboard</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-white/5 text-white font-medium"
                  : "text-[var(--color-muted)] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)] space-y-2">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-muted)] hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="text-xs">←</span>
          Home
        </Link>
        <div className="text-xs text-[var(--color-muted)]">v0.1.0</div>
      </div>
    </aside>
  );
}
