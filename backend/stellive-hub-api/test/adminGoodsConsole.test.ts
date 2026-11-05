import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { renderAdminConsoleHtml } from "../src/admin/adminConsoleHtml.js";
import { goodsImportScriptSource, loadGoodsImportHelpers } from "../src/admin/adminGoodsImport.js";
import { enAdminMessages, koAdminMessages, translateAdmin, type AdminMessageKey } from "../src/admin/adminI18n.js";

const locales = ["en", "ko"] as const;

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

describe("admin console goods list section", () => {
  it("keeps goods i18n keys in English/Korean parity with Korean text for every goods label", () => {
    const goodsKeys = Object.keys(enAdminMessages).filter((key) => key.startsWith("goods."));
    expect(goodsKeys.length).toBeGreaterThan(40);
    expect(Object.keys(koAdminMessages).filter((key) => key.startsWith("goods.")).sort()).toEqual([...goodsKeys].sort());
    for (const key of goodsKeys as AdminMessageKey[]) {
      expect(koAdminMessages[key], key).not.toBe("");
      if (key !== "goods.rowNumber" && key !== "goods.importPlaceholder") {
        expect(koAdminMessages[key], key).not.toBe(enAdminMessages[key]);
      }
    }
    expect(translateAdmin("ko", "goods.tab", { count: 3 })).toBe("굿즈 목록 (3)");
    expect(translateAdmin("en", "goods.limitBadge", { count: 2 })).toBe("Limit 2");
  });

  it("has a localized message for every parser error code", () => {
    const codes = [...goodsImportScriptSource.matchAll(/addError\([^,]+,[^,]+,\s*"([a-z_]+)"/g)].map((match) => match[1]);
    expect(new Set(codes).size).toBeGreaterThanOrEqual(15);
    for (const code of new Set(codes)) {
      expect(Object.hasOwn(enAdminMessages, `goods.err.${code}`), code).toBe(true);
      expect(Object.hasOwn(koAdminMessages, `goods.err.${code}`), code).toBe(true);
    }
  });

  it("renders the goods tab, panel, editor dialog and import controls with stable ids and option values", () => {
    for (const locale of locales) {
      const html = renderAdminConsoleHtml(locale);
      for (const id of [
        "hub-event-goods-tab",
        "hub-event-goods-fields",
        "hub-event-goods-items",
        "hub-event-goods-add",
        "hub-event-goods-toggle",
        "hub-event-goods-dialog",
        "hub-event-goods-form",
        "hub-event-goods-members",
        "hub-event-goods-phase",
        "hub-event-goods-import-text",
        "hub-event-goods-import-preview",
        "hub-event-goods-import-apply",
        "hub-event-goods-import-result"
      ]) {
        expect(html, id).toContain(`id="${id}"`);
      }
      expect(html).toContain('data-hub-event-tab="goods"');
      expect(html).toContain(`<option value="onsite">${translateAdmin(locale, "goods.channelOnsite")}</option>`);
      expect(html).toContain(`<option value="online">${translateAdmin(locale, "goods.channelOnline")}</option>`);
      expect(html).toContain(`<option value="both">${translateAdmin(locale, "goods.channelBoth")}</option>`);
      expect(html).toContain(translateAdmin(locale, "goods.importApply"));
      expect(html).toContain('"/goods-items"');
      expect(html).not.toContain("￹");
    }
    expect(renderAdminConsoleHtml("ko")).toContain("검증 후 교체");
    expect(renderAdminConsoleHtml("en")).toContain("Validate and replace");
  });

  it("targets the documented goods routes and only default categories open the section", () => {
    const html = renderAdminConsoleHtml("en");
    expect(html).toContain('const goodsDefaultCategories = ["online_goods", "offline_popup", "online_collab", "offline_collab", "offline_concert"];');
    expect(html).toContain('goodsBasePath() + (editId ? "/" + encodeURIComponent(editId) : "")');
    expect(html).toContain('method: editId ? "PATCH" : "POST"');
    expect(html).toContain('goodsBasePath() + "/order"');
    expect(html).toContain("goodsItemIds: ids");
    expect(html).toContain('"/restore"');
    expect(html).toContain("items: goodsImportState.items");
    // The static list has no availability / sold-out control.
    expect(html).not.toMatch(/hub-event-goods-(availability|sold-?out)|availability:/i);
  });

  it("emits syntactically valid inline scripts whose embedded parser matches the tested source", () => {
    for (const locale of locales) {
      const html = renderAdminConsoleHtml(locale);
      const scripts = inlineScripts(html);
      expect(scripts.length).toBeGreaterThan(0);
      for (const script of scripts) {
        expect(() => new vm.Script(script)).not.toThrow();
      }
      // Regex escapes inside the shared parser source must survive the console template literal untouched.
      expect(html).toContain(goodsImportScriptSource);
      expect(html).toContain(String.raw`/^items\[(\d+)\](?:\.(.+))?$/`);
    }
  });

  it("does not render operator-controlled values through innerHTML in the goods editor", () => {
    const html = renderAdminConsoleHtml("en");
    const start = html.indexOf("const hubEventGoodsPanel");
    const end = html.indexOf("function setSelectedHubEventId");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const goodsBlock = html.slice(start, end);
    expect(goodsBlock).not.toContain("innerHTML");
    expect(goodsBlock).not.toContain("insertAdjacentHTML");
  });

  it("parses the stellive-event-brief JSON shape with schedule labels end to end", () => {
    const { parseGoodsImport, parseGoodsServerErrorField } = loadGoodsImportHelpers();
    const result = parseGoodsImport(
      JSON.stringify({
        goodsItems: [{ name: "슬로건", memberIds: ["yuni"], priceKrw: 5000, salesChannel: "onsite", scheduleItemLabel: "현장 판매" }]
      }),
      {
        members: [{ id: "yuni", koreanName: "유니", englishName: "Yuni" }],
        scheduleItems: [{ id: "s1", label: "현장 판매", title: "현장 판매 시작" }]
      }
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([{ name: "슬로건", memberIds: ["yuni"], priceKrw: 5000, salesChannel: "onsite", scheduleItemId: "s1" }]);
    expect(parseGoodsServerErrorField("items[0].purchaseUrl")).toEqual({ row: 0, field: "purchaseUrl" });
  });
});
