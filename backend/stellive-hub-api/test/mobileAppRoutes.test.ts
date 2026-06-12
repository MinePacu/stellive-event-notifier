import { describe, expect, it } from "vitest";
import { mobileError } from "../src/mobile/mobileError.js";
import { registerAppRoutes } from "../src/routes/appRoutes.js";

describe("mobile app route helpers", () => {
  it("formats mobile route errors without leaking internal details", () => {
    expect(mobileError("device_not_registered", 400)).toEqual({
      statusCode: 400,
      payload: { error: "device_not_registered" },
    });
  });

  it("exports the mobile route registrar", () => {
    expect(registerAppRoutes).toEqual(expect.any(Function));
  });
});
