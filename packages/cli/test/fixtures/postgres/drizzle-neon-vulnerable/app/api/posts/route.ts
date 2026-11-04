import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

export async function GET(req: Request) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const sort = new URL(req.url).searchParams.get('sort');
  const rows = await db.execute(sql.raw(`select * from orders order by ${sort}`));
  return Response.json(rows);
}
