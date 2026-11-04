import { PrismaClient } from '@prisma/client';

export async function GET() {
  const prisma = new PrismaClient();
  const customers = await prisma.customer.findMany();
  return Response.json(customers);
}
