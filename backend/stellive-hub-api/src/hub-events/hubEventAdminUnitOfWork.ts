import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import { PlatformEventRepository } from "../repositories/platformEventRepository.js";
import { getPrismaClient } from "../storage/prisma.js";
import type {
  HubEventAdminTransactionRepositories,
  HubEventAdminUnitOfWork
} from "./hubEventAdminService.js";
import { HubEventRepository } from "./hubEventRepository.js";

export class PrismaHubEventAdminUnitOfWork implements HubEventAdminUnitOfWork {
  async run<T>(work: (repositories: HubEventAdminTransactionRepositories) => Promise<T>): Promise<T> {
    return getPrismaClient().$transaction(async (transaction) => work({
      hubEvents: new HubEventRepository(transaction as never),
      platformEvents: new PlatformEventRepository(transaction as never),
      notificationJobs: new NotificationJobRepository(transaction as never)
    }));
  }
}

export default PrismaHubEventAdminUnitOfWork;
