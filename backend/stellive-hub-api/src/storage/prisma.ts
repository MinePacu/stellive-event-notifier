import { PrismaClient } from "@prisma/client";

let prismaClient: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  prismaClient ??= new PrismaClient();
  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaClient) return;
  const client = prismaClient;
  prismaClient = undefined;
  await client.$disconnect();
}
