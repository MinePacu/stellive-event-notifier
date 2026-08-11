import { describe, expect, it, vi } from "vitest";
import { PrismaEventPersistenceUnitOfWork } from "../src/storage/eventPersistenceUnitOfWork.js";

describe("PrismaEventPersistenceUnitOfWork", () => {
  it("uses serializable transactions and retries one write conflict once", async () => {
    const transaction = vi.fn(async (operation: (client: never) => Promise<string>, options: unknown) => {
      expect(options).toEqual({ isolationLevel: "Serializable" });
      if (transaction.mock.calls.length === 1) throw { code: "P2034" };
      return operation({} as never);
    });
    const unitOfWork = new PrismaEventPersistenceUnitOfWork({ $transaction: transaction } as never);

    await expect(unitOfWork.runInTransaction(async () => "committed")).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-conflict failures", async () => {
    const transaction = vi.fn(async () => {
      throw new Error("write_failed");
    });
    const unitOfWork = new PrismaEventPersistenceUnitOfWork({ $transaction: transaction } as never);

    await expect(unitOfWork.runInTransaction(async () => "unreachable")).rejects.toThrow("write_failed");
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
