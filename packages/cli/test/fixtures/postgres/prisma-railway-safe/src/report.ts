import { sql, type Kysely } from 'kysely';

const SORTABLE = { email: sql.ref('email'), id: sql.ref('id') };

export function customersReport(db: Kysely<any>, orderBy: keyof typeof SORTABLE) {
  return sql`select * from customers order by ${SORTABLE[orderBy]} ${sql.raw('asc')}`.execute(db);
}
