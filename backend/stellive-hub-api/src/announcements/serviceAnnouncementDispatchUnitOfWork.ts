import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import PlatformEventRepository from "../repositories/platformEventRepository.js";
import { getPrismaClient } from "../storage/prisma.js";
import { ServiceAnnouncementRepository } from "./serviceAnnouncementRepository.js";

export interface ServiceAnnouncementDispatchRepositories {
  announcements: ServiceAnnouncementRepository;
  platformEvents: PlatformEventRepository;
  notificationJobs: NotificationJobRepository;
}

export interface ServiceAnnouncementDispatchUnitOfWork {
  run<T>(work: (repositories: ServiceAnnouncementDispatchRepositories) => Promise<T>): Promise<T>;
}

export class PrismaServiceAnnouncementDispatchUnitOfWork implements ServiceAnnouncementDispatchUnitOfWork {
  async run<T>(work: (repositories: ServiceAnnouncementDispatchRepositories) => Promise<T>): Promise<T> {
    return getPrismaClient().$transaction(async (transaction) => work({
      announcements: new ServiceAnnouncementRepository(transaction as never),
      platformEvents: new PlatformEventRepository(transaction as never),
      notificationJobs: new NotificationJobRepository(transaction as never),
    }));
  }
}
