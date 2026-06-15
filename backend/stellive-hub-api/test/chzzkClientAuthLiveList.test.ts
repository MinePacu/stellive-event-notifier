import { describe, expect, it, vi } from "vitest";
import ChzzkApiClient from "../src/adapters/chzzk/chzzkApiClient.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function fakeStateRepository() {
  const repository = {
    health: undefined as unknown,
    getState: vi.fn(),
    upsertState: vi.fn(),
    upsertAdapterHealth: vi.fn(async (_source: string, health: unknown) => {
      repository.health = health;
    })
  };

  return repository;
}

function client(fetchMock: ReturnType<typeof vi.fn>) {
  return new ChzzkApiClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    stateRepository: fakeStateRepository(),
    fetch: fetchMock as unknown as typeof fetch,
    liveListPageSize: 20
  });
}

describe("ChzzkApiClient client-auth live list", () => {
  it("uses client authentication and fetches the documented live list endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 200,
        message: null,
        content: {
          page: { next: null },
          data: [
            {
              channelId: "chzzk-channel-id",
          liveTitle: "Live title",
          channelImageUrl: "https://img.example/yuni.jpg",
              status: "OPEN",
              openDate: "2026-06-11T03:00:00.000Z",
              concurrentUserCount: 1234
            }
          ]
        }
      })
    );

    await expect(client(fetchMock).getLiveStatus("chzzk-channel-id")).resolves.toEqual({
      channelId: "chzzk-channel-id",
      isLive: true,
      title: "Live title",
      channelImageUrl: "https://img.example/yuni.jpg",
      openDate: "2026-06-11T03:00:00.000Z",
      viewerCount: 1234,
      platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
      sourceVerificationState: "verified"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://openapi.chzzk.naver.com/open/v1/lives?size=20",
      expect.objectContaining({
        headers: {
          "Client-Id": "client-id",
          "Client-Secret": "client-secret",
          "Content-Type": "application/json"
        }
      })
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({
      headers: expect.objectContaining({ authorization: expect.any(String) })
    });
  });

  it("treats presence in the CHZZK live list as live when status is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 200,
        message: null,
        content: {
          page: {},
          data: [
            {
              channelId: "chzzk-channel-id",
              liveTitle: "Live without status",
              openDate: "2026-06-11T03:00:00.000Z",
              concurrentUserCount: 1234
            }
          ]
        }
      })
    );

    await expect(client(fetchMock).getLiveStatus("chzzk-channel-id")).resolves.toMatchObject({
      channelId: "chzzk-channel-id",
      isLive: true,
      title: "Live without status",
      sourceVerificationState: "verified"
    });
  });

  it("returns verified offline when the live list does not include the catalog channel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 200,
        message: null,
        content: { page: { next: null }, data: [] }
      })
    );

    await expect(client(fetchMock).getLiveStatus("chzzk-channel-id")).resolves.toEqual({
      channelId: "chzzk-channel-id",
      isLive: false,
      platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
      sourceVerificationState: "verified"
    });
  });

  it("pages through live list results until the catalog channel is found", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          code: 200,
        message: null,
          content: {
            page: { next: "cursor-2" },
            data: [{ channelId: "other-channel-id", status: "OPEN" }]
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 200,
        message: null,
          content: {
            page: { next: null },
            data: [{ channelId: "chzzk-channel-id", status: "OPEN", liveTitle: "Page 2" }]
          }
        })
      );

    await expect(client(fetchMock).getLiveStatus("chzzk-channel-id")).resolves.toMatchObject({
      channelId: "chzzk-channel-id",
      isLive: true,
      title: "Page 2",
      sourceVerificationState: "verified"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://openapi.chzzk.naver.com/open/v1/lives?size=20",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://openapi.chzzk.naver.com/open/v1/lives?size=20&next=cursor-2",
      expect.any(Object)
    );
  });
});
