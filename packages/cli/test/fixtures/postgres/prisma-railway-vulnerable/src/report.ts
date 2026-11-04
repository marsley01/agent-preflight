import { sql, type Kysely } from 'kysely';

export function customersReport(db: Kysely<any>, orderBy: string) {
  return sql`select * from customers order by ${sql.raw(orderBy)}`.execute(db);
}
