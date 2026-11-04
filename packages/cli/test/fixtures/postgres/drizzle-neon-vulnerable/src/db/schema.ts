import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
});

export const orders = pgTable('orders', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  total: integer('total').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
