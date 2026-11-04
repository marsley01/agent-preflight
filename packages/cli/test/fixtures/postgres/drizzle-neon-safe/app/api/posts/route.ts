import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

// One HTTP client per module: stateless, safe to reuse.
const db = drizzle(neon(process.env.DATABASE_URL!));

export async function GET(req: Request) {
  const sort = new URL(req.url).searchParams.get('sort') === 'total' ? 'total' : 'created_at';
  const rows = await db.execute(sql`select * from orders order by ${sql.identifier(sort)}`);
  const health = await db.execute(sql.raw('select 1'));
  return Response.json({ rows, health });
}
