import type { ProjectContext, SourceFile } from '../context.js';

/** A table discovered from an ORM schema (Drizzle pgTable or Prisma model). */
export interface OrmTable {
  name: string;
  file: string;
  line: number;
  source: 'drizzle' | 'prisma';
  /** RLS enabled in the ORM schema itself (Drizzle only; Prisma has no RLS syntax). */
  rls: boolean;
  /** At least one policy defined in the ORM schema. */
  policy: boolean;
}

const lineOf = (f: SourceFile, index: number) => f.content.slice(0, index).split('\n').length;

/** Index just past the `)` that closes the `(` at `open`, skipping string and template literals. */
function closingParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) return src.length;
      i = end;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return src.length;
}

/**
 * Drizzle tables: `pgTable('name', ...)` and `pgTable.withRLS('name', ...)`. RLS counts as enabled
 * by withRLS, any pgPolicy/crudPolicy in the table's extra-config (Drizzle enables RLS when a table
 * has a policy), `pgPolicy(...).link(table)`, or the older `.enableRLS()`.
 */
export function drizzleTables(ctx: ProjectContext): OrmTable[] {
  const tables: OrmTable[] = [];
  for (const f of ctx.code.filter((file) => /\bpgTable\b/.test(file.content))) {
    for (const m of f.content.matchAll(/(?:const\s+(\w+)\s*=\s*)?\bpgTable(\.withRLS)?\s*\(\s*['"`]([\w.]+)['"`]/g)) {
      const call = f.content.slice(m.index!, closingParen(f.content, m.index! + m[0].indexOf('(')));
      const after = f.content.slice(m.index! + call.length, m.index! + call.length + 40);
      const variable = m[1];
      const linked = variable !== undefined && new RegExp(String.raw`\.link\(\s*${variable}\s*\)`).test(f.content);
      const policy = /\b(pgPolicy|crudPolicy)\s*\(/.test(call) || linked;
      tables.push({
        name: m[3].split('.').pop()!,
        file: f.rel,
        line: lineOf(f, m.index!),
        source: 'drizzle',
        rls: Boolean(m[2]) || policy || /^\s*\.enableRLS\(\)/.test(after),
        policy,
      });
    }
  }
  return tables;
}

/** Prisma models (table name from @@map when present). */
export function prismaTables(ctx: ProjectContext): OrmTable[] {
  const tables: OrmTable[] = [];
  for (const f of ctx.find(/\.prisma$/)) {
    for (const m of f.content.matchAll(/^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) {
      const mapped = m[2].match(/@@map\(\s*["']([\w.]+)["']\s*\)/)?.[1];
      tables.push({ name: mapped ?? m[1], file: f.rel, line: lineOf(f, m.index!), source: 'prisma', rls: false, policy: false });
    }
  }
  return tables;
}
