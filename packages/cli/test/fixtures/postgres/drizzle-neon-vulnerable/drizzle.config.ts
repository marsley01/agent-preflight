import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://neondb_owner:Sup3rS3cretPw@ep-quiet-sea-123456.us-east-2.aws.neon.tech/neondb?sslmode=require',
  },
});
