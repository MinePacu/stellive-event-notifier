export interface ShutdownLogger {
  info(message: string): void;
  info(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface GracefulShutdownOptions {
  closeApp: () => Promise<void>;
  disconnectPrisma: () => Promise<void>;
  logger: ShutdownLogger;
  setExitCode?: (code: number) => void;
}

export function createGracefulShutdown(options: GracefulShutdownOptions) {
  let shutdownPromise: Promise<void> | undefined;

  return (signal: NodeJS.Signals): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;

    options.logger.info({ signal }, "graceful shutdown started");
    shutdownPromise = (async () => {
      let failure: unknown;
      try {
        await options.closeApp();
      } catch (error) {
        failure = error;
      }

      try {
        await options.disconnectPrisma();
      } catch (error) {
        failure ??= error;
      }

      if (failure) {
        options.logger.error({ error: failure }, "graceful shutdown failed");
        (options.setExitCode ?? ((code) => { process.exitCode = code; }))(1);
        return;
      }

      options.logger.info("graceful shutdown completed");
    })();

    return shutdownPromise;
  };
}
