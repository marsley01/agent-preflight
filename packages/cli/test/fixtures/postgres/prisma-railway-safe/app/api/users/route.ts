import { prisma } from '../../../lib/db';

export async function GET() {
  const customers = await prisma.customer.findMany();
  return Response.json(customers);
}
