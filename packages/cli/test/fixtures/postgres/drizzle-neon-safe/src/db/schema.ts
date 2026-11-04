import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { crudPolicy, authenticatedRole, authUid } from 'drizzle-orm/neon';

export const users = pgTable.withRLS('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
});

export const orders = pgTable(
  'orders',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    total: integer('total').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    crudPolicy({ role: authenticatedRole, read: authUid(table.userId), modify: authUid(table.userId) }),
  ],
);
