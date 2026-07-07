import type { FcmClient, PushSendResult } from "./fcmClient.js";
import type { MinimalPushPayload } from "./pushPayloadFactory.js";

export interface PushTargetDevice {
  deviceId: string;
  platform: "android" | "ios";
  pushProvider: "fcm" | "apns_via_fcm";
  pushToken: string;
  tokenStatus: "active" | "missing" | "invalid" | "disabled";
  timezone?: string;
  locale?: string;
  appVersion?: string;
}

export interface PushSender {
  sendToDevice(input: { device: PushTargetDevice; payload: MinimalPushPayload }): Promise<PushSendResult>;
  sendToDevices?(input: { devices: PushTargetDevice[]; payload: MinimalPushPayload }): Promise<PushSendResult[]>;
}

export class FcmPushSender implements PushSender {
  constructor(private readonly fcmClient: FcmClient) {}

  async sendToDevice(input: { device: PushTargetDevice; payload: MinimalPushPayload }): Promise<PushSendResult> {
    return this.fcmClient.send({
      token: input.device.pushToken,
      payload: input.payload
    });
  }

  async sendToDevices(input: { devices: PushTargetDevice[]; payload: MinimalPushPayload }): Promise<PushSendResult[]> {
    return this.fcmClient.sendEach({
      tokens: input.devices.map((device) => device.pushToken),
      payload: input.payload
    });
  }
}
