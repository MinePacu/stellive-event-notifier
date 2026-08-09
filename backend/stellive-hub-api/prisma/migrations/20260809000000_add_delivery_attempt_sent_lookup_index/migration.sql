CREATE INDEX "DeliveryAttempt_eventId_status_deviceId_idx"
ON "DeliveryAttempt"("eventId", "status", "deviceId");
