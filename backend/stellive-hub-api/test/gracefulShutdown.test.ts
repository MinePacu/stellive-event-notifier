import { describe, expect, it, vi } from "vitest";
import { createGracefulShutdown } from "../src/process/gracefulShutdown.js";

describe("graceful shutdown", () => {
  it("closes the app and Prisma once when signals repeat", async () => {
    const closeApp = vi.fn().mockResolvedValue(undefined);
    const disconnectPrisma = vi.fn().mockResolvedValue(undefined);
    const info = vi.fn();
    const error = vi.fn();
    const setExitCode = vi.fn();
    const shutdown = createGracefulShutdown({
      closeApp,
      disconnectPrisma,
      logger: { info, error },
      setExitCode
    });

    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

    expect(closeApp).toHaveBeenCalledTimes(1);
    expect(disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith({ signal: "SIGTERM" }, "graceful shutdown started");
    expect(info).toHaveBeenCalledWith("graceful shutdown completed");
    expect(error).not.toHaveBeenCalled();
    expect(setExitCode).not.toHaveBeenCalled();
  });

  it("disconnects Prisma and marks failure when closing the app fails", async () => {
    const failure = new Error("close failed");
    const disconnectPrisma = vi.fn().mockResolvedValue(undefined);
    const error = vi.fn();
    const setExitCode = vi.fn();
    const shutdown = createGracefulShutdown({
      closeApp: vi.fn().mockRejectedValue(failure),
      disconnectPrisma,
      logger: { info: vi.fn(), error },
      setExitCode
    });

    await shutdown("SIGTERM");

    expect(disconnectPrisma).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith({ error: failure }, "graceful shutdown failed");
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
