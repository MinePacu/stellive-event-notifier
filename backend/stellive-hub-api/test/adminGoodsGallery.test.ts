import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { renderAdminConsoleHtml } from "../src/admin/adminConsoleHtml.js";
import {
  goodsGalleryParserSource,
  goodsGalleryUiSource,
  loadGoodsGalleryHelpers,
  renderAdminGoodsGalleryScript
} from "../src/admin/adminGoodsGallery.js";
import { enAdminMessages, koAdminMessages, translateAdmin, type AdminMessageKey } from "../src/admin/adminI18n.js";

const helpers = loadGoodsGalleryHelpers();
const { parseGoodsGalleryImport, goodsGalleryCheckImages, buildGoodsGalleryPayload, parseGoodsGalleryServerErrorField } = helpers;
const context = { sourceUrl: "https://www.stellive.me/notice/1", sourceLabel: "공식 공지" };
const url1 = "https://www.stellive.me/images/md-1.jpg";
const url2 = "https://pbs.twimg.com/media/abc.jpg";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

describe("admin goods gallery parser", () => {
  it("parses one URL per line with defaults and auto-numbered alt text", () => {
    const result = parseGoodsGalleryImport(`\n${url1}\r\n  ${url2}  \n\n`, context);
    expect(result.format).toBe("lines");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.images).toEqual([
      { policyState: "official_runtime_url", kind: "md", url: url1, altText: "MD 리스트 1", sourceLabel: "공식 공지", sourceUrl: context.sourceUrl },
      { policyState: "official_runtime_url", kind: "md", url: url2, altText: "MD 리스트 2", sourceLabel: "공식 공지", sourceUrl: context.sourceUrl }
    ]);
  });

  it("continues alt text numbering after existing rows", () => {
    const result = parseGoodsGalleryImport(url2, { ...context, startIndex: 3, existingUrls: [url1] });
    expect(result.images[0]?.altText).toBe("MD 리스트 4");
    expect(result.errors).toEqual([]);
  });

  it("parses the { goodsListImages } JSON object and keeps provided fields", () => {
    const result = parseGoodsGalleryImport(
      JSON.stringify({
        goodsListImages: [
          { policyState: "official_runtime_url", url: url1, altText: "특전 리스트", sourceLabel: "X 공지", sourceUrl: "https://x.com/StelLive_kr/status/1" },
          { url: url2 }
        ]
      }),
      context
    );
    expect(result.format).toBe("json");
    expect(result.errors).toEqual([]);
    expect(result.images[0]).toEqual({
      policyState: "official_runtime_url",
      kind: "md",
      url: url1,
      altText: "특전 리스트",
      sourceLabel: "X 공지",
      sourceUrl: "https://x.com/StelLive_kr/status/1"
    });
    expect(result.images[1]?.altText).toBe("MD 리스트 2");
    expect(result.images[1]?.sourceUrl).toBe(context.sourceUrl);
  });

  it("parses a bare JSON array of objects and strings", () => {
    const result = parseGoodsGalleryImport(JSON.stringify([{ url: url1 }, url2]), context);
    expect(result.format).toBe("json");
    expect(result.errors).toEqual([]);
    expect(result.images.map((image) => image?.url)).toEqual([url1, url2]);
  });

  it("accepts kind from JSON, defaults to md, and numbers alt text per kind", () => {
    const result = parseGoodsGalleryImport(
      JSON.stringify([{ url: url1 }, { url: url2, kind: "bonus" }, { url: "https://www.stellive.me/c.jpg", kind: "bonus" }, { url: "https://www.stellive.me/d.jpg", kind: "bonus", altText: "직접 입력" }, { url: "https://www.stellive.me/e.jpg", kind: "md" }]),
      context
    );
    expect(result.errors).toEqual([]);
    expect(result.images.map((image) => [image?.kind, image?.altText])).toEqual([
      ["md", "MD 리스트 1"],
      ["bonus", "특전 리스트 1"],
      ["bonus", "특전 리스트 2"],
      ["bonus", "직접 입력"],
      ["md", "MD 리스트 2"]
    ]);
    // Numbering continues after the kinds already in the editor; line mode is always md.
    const appended = parseGoodsGalleryImport(url1, { ...context, startIndex: 3, existingKinds: ["md", "bonus", "bonus"] });
    expect(appended.images[0]).toMatchObject({ kind: "md", altText: "MD 리스트 2" });
    const bad = parseGoodsGalleryImport(JSON.stringify([{ url: url1, kind: "poster" }]), context);
    expect(bad.errors).toEqual([{ index: 0, field: "kind", code: "kind_invalid", detail: "poster" }]);
  });

  it("sends kind in the payload (bonus kept, unknown falls back to md)", () => {
    expect(
      buildGoodsGalleryPayload([
        { policyState: "official_runtime_url", kind: "bonus", url: url1 },
        { policyState: "official_runtime_url", url: url2 }
      ])
    ).toEqual([
      { policyState: "official_runtime_url", kind: "bonus", url: url1 },
      { policyState: "official_runtime_url", kind: "md", url: url2 }
    ]);
  });

  it("reports shape, parse, empty and field-type errors with entry indexes", () => {
    expect(parseGoodsGalleryImport("   ", context).errors).toEqual([{ index: -1, field: "", code: "empty", detail: "" }]);
    expect(parseGoodsGalleryImport("{oops", context).errors[0]).toMatchObject({ index: -1, code: "json_parse" });
    expect(parseGoodsGalleryImport('{"goodsItems":[]}', context).errors[0]).toMatchObject({ index: -1, code: "json_shape" });
    const result = parseGoodsGalleryImport(JSON.stringify([{ url: url1 }, 7, { url: 5 }, { url: url2, policyState: "weird" }]), context);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ index: 1, code: "item_not_object" }),
        expect.objectContaining({ index: 2, field: "url", code: "field_not_string" }),
        expect.objectContaining({ index: 3, field: "policyState", code: "policy_invalid", detail: "weird" })
      ])
    );
  });

  it("rejects non-https, invalid and missing URLs", () => {
    const result = parseGoodsGalleryImport(["http://www.stellive.me/a.jpg", "not a url", "https://www.stellive.me/a b.jpg"].join("\n"), context);
    expect(result.errors.map((error) => [error.index, error.field, error.code])).toEqual([
      [0, "url", "url_not_https"],
      [1, "url", "url_invalid"],
      [2, "url", "url_invalid"]
    ]);
    const missing = parseGoodsGalleryImport(JSON.stringify([{ altText: "x" }]), context);
    expect(missing.errors).toEqual([{ index: 0, field: "url", code: "url_required", detail: "" }]);
  });

  it("requires an https source URL and source label when the policy needs them", () => {
    const noSource = parseGoodsGalleryImport(url1, { sourceUrl: "", sourceLabel: "" });
    expect(noSource.errors.map((error) => error.code)).toEqual(["source_url_required", "source_label_required"]);
    const badSource = parseGoodsGalleryImport(JSON.stringify([{ url: url1, sourceUrl: "http://x.com/1" }]), context);
    expect(badSource.errors).toEqual([{ index: 0, field: "sourceUrl", code: "source_url_not_https", detail: "" }]);
    // verify_required / blocked do not require source metadata.
    const blocked = parseGoodsGalleryImport(JSON.stringify([{ url: url1, policyState: "blocked" }]), { sourceUrl: "", sourceLabel: "" });
    expect(blocked.errors).toEqual([]);
  });

  it("warns (does not error) for hosts outside the official allowlist", () => {
    const result = parseGoodsGalleryImport(["https://example.com/a.jpg", "https://cdn.stellive.me/a.jpg", "https://evilstellive.me/a.jpg"].join("\n"), context);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => [warning.index, warning.code, warning.detail])).toEqual([
      [0, "host_not_allowed", "example.com"],
      [2, "host_not_allowed", "evilstellive.me"]
    ]);
    // The allowlist only applies to official_runtime_url.
    const thirdParty = parseGoodsGalleryImport(JSON.stringify([{ url: "https://example.com/a.jpg", policyState: "third_party_allowed" }]), context);
    expect(thirdParty.warnings).toEqual([]);
    expect(helpers.isGoodsGalleryAllowedHost("STELLIVE.me")).toBe(true);
    expect(helpers.isGoodsGalleryAllowedHost("pbs.twimg.com")).toBe(true);
    expect(helpers.isGoodsGalleryAllowedHost("video.twimg.com")).toBe(false);
  });

  it("warns on duplicate URLs within the paste and against existing rows", () => {
    const result = parseGoodsGalleryImport([url1, url2, url1].join("\n"), { ...context, existingUrls: [url2] });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => [warning.index, warning.code])).toEqual([
      [1, "duplicate_url"],
      [2, "duplicate_url"]
    ]);
  });

  it("enforces the 20 image limit including existing rows", () => {
    const urls = Array.from({ length: 21 }, (_, index) => `https://www.stellive.me/images/${index}.jpg`);
    expect(parseGoodsGalleryImport(urls.join("\n"), context).errors).toEqual([{ index: -1, field: "", code: "too_many", detail: "20" }]);
    expect(parseGoodsGalleryImport(urls.slice(0, 20).join("\n"), context).errors).toEqual([]);
    expect(parseGoodsGalleryImport(urls.slice(0, 3).join("\n"), { ...context, startIndex: 18 }).errors[0]?.code).toBe("too_many");
    expect(helpers.GOODS_GALLERY_MAX).toBe(20);
  });

  it("checks existing editor rows with the same rules", () => {
    const checked = goodsGalleryCheckImages([
      { policyState: "official_runtime_url", url: url1, sourceLabel: "a", sourceUrl: "https://x.com/1" },
      { policyState: "none", url: "" },
      { policyState: "official_runtime_url", url: "", sourceLabel: "a", sourceUrl: "https://x.com/1" }
    ]);
    expect(checked.errors).toEqual([{ index: 2, field: "url", code: "url_required", detail: "" }]);
  });

  it("builds the PUT payload without empty fields and clears with an empty list", () => {
    expect(buildGoodsGalleryPayload([])).toEqual([]);
    expect(
      buildGoodsGalleryPayload([
        { policyState: "official_runtime_url", url: ` ${url1} `, altText: "", sourceLabel: "공식 공지", sourceUrl: context.sourceUrl },
        { policyState: "none", url: url2, altText: "x" }
      ])
    ).toEqual([
      { policyState: "official_runtime_url", kind: "md", url: url1, sourceLabel: "공식 공지", sourceUrl: context.sourceUrl },
      { policyState: "none" }
    ]);
  });

  it("maps server error paths to rows", () => {
    expect(parseGoodsGalleryServerErrorField("goodsListImages.3.url")).toEqual({ row: 3, field: "url" });
    expect(parseGoodsGalleryServerErrorField("goodsListImages.12")).toEqual({ row: 12, field: "" });
    expect(parseGoodsGalleryServerErrorField("goodsListImages")).toEqual({ row: -1, field: "" });
    expect(parseGoodsGalleryServerErrorField("image.url")).toBeNull();
    expect(parseGoodsGalleryServerErrorField("goodsListImagesX.1.url")).toBeNull();
  });
});

describe("admin console goods gallery section", () => {
  const galleryKeys = Object.keys(enAdminMessages).filter((key) => key.startsWith("goodsGallery."));

  it("keeps goodsGallery i18n keys in English/Korean parity with Korean text", () => {
    expect(galleryKeys.length).toBeGreaterThan(40);
    expect(Object.keys(koAdminMessages).filter((key) => key.startsWith("goodsGallery.")).sort()).toEqual([...galleryKeys].sort());
    for (const key of galleryKeys as AdminMessageKey[]) {
      expect(koAdminMessages[key], key).not.toBe("");
      if (key !== "goodsGallery.count" && key !== "goodsGallery.importPlaceholder") {
        expect(koAdminMessages[key], key).not.toBe(enAdminMessages[key]);
      }
    }
    expect(translateAdmin("ko", "goodsGallery.count", { count: 3, max: 20 })).toBe("3 / 20장");
  });

  it("has localized error and warning messages for every parser code", () => {
    const errorCodes = new Set([...goodsGalleryParserSource.matchAll(/addError\([^,]+,[^,]+,\s*"([a-z_]+)"/g)].map((match) => match[1]));
    const warningCodes = new Set([...goodsGalleryParserSource.matchAll(/addWarning\([^,]+,[^,]+,\s*"([a-z_]+)"/g)].map((match) => match[1]));
    expect(errorCodes.size).toBeGreaterThanOrEqual(12);
    expect(warningCodes).toEqual(new Set(["host_not_allowed", "duplicate_url"]));
    for (const code of errorCodes) {
      expect(galleryKeys, code).toContain(`goodsGallery.err.${code}`);
    }
    for (const code of warningCodes) {
      expect(galleryKeys, code).toContain(`goodsGallery.warn.${code}`);
    }
    for (const state of ["none", "official_runtime_url", "third_party_allowed", "verify_required", "blocked"]) {
      expect(galleryKeys).toContain(`goodsGallery.policy.${state}`);
    }
  });

  it("renders the gallery block inside the goods panel above the goods items editor", () => {
    for (const locale of ["en", "ko"] as const) {
      const html = renderAdminConsoleHtml(locale);
      for (const id of [
        "hub-event-goods-gallery",
        "hub-event-goods-gallery-count",
        "hub-event-goods-gallery-add",
        "hub-event-goods-gallery-errors",
        "hub-event-goods-gallery-empty",
        "hub-event-goods-gallery-list",
        "hub-event-goods-gallery-import-text",
        "hub-event-goods-gallery-import-append",
        "hub-event-goods-gallery-import-replace",
        "hub-event-goods-gallery-import-result"
      ]) {
        expect(html, id).toContain(`id="${id}"`);
      }
      const panel = html.indexOf('id="hub-event-goods-fields"');
      const gallery = html.indexOf('id="hub-event-goods-gallery"');
      const items = html.indexOf('id="hub-event-goods-items"');
      expect(panel).toBeGreaterThan(0);
      expect(gallery).toBeGreaterThan(panel);
      expect(items).toBeGreaterThan(gallery);
      expect(html).toContain(translateAdmin(locale, "goodsGallery.title"));
      expect(html).not.toContain("￹");
    }
  });

  it("wires goodsListImages into the event write body and server error mapping", () => {
    const html = renderAdminConsoleHtml("en");
    expect(html).toContain("collectGoodsGalleryInput(input);");
    expect(html).toContain("showGoodsGalleryServerErrors(errors);");
    expect(html).toContain("bindGoodsGalleryForEvent(event);");
    expect(html).toContain("input.goodsListImages = buildGoodsGalleryPayload(goodsGalleryRows)");
    expect(html).toContain('loading = "lazy"');
    expect(html).toContain('setAttribute("referrerpolicy", "no-referrer")');
  });

  it("emits syntactically valid inline scripts whose embedded source matches the tested source", () => {
    expect(() => new vm.Script(renderAdminGoodsGalleryScript())).not.toThrow();
    for (const locale of ["en", "ko"] as const) {
      const html = renderAdminConsoleHtml(locale);
      for (const script of inlineScripts(html)) {
        expect(() => new vm.Script(script)).not.toThrow();
      }
      // Regex escapes inside the shared source must survive the console template literal untouched.
      expect(html).toContain(goodsGalleryParserSource);
      expect(html).toContain(goodsGalleryUiSource);
      expect(html).toContain(String.raw`/^goodsListImages(?:\.(\d+)(?:\.(.+))?)?$/`);
    }
  });

  it("does not render operator-controlled values through innerHTML in the gallery editor", () => {
    expect(goodsGalleryUiSource).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(goodsGalleryParserSource).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
});

// Minimal DOM double: just enough surface for the gallery editor, with textContent-only text so injected markup stays inert.
class FakeNode {
  children: FakeNode[] = [];
  attrs: Record<string, string> = {};
  listeners: Record<string, Array<() => void>> = {};
  classes = new Set<string>();
  textContent = "";
  value = "";
  hidden = false;
  disabled = false;
  className = "";
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name)
  };
  constructor(public tag: string) {}
  append(...nodes: FakeNode[]) { this.children.push(...nodes); }
  appendChild(node: FakeNode) { this.children.push(node); return node; }
  replaceChildren(...nodes: FakeNode[]) { this.children = [...nodes]; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  removeAttribute(name: string) { delete this.attrs[name]; }
  addEventListener(type: string, handler: () => void) { (this.listeners[type] ??= []).push(handler); }
  fire(type: string) { (this.listeners[type] ?? []).forEach((handler) => handler()); }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
}

function createGalleryHarness() {
  const nodes = new Map<string, FakeNode>();
  for (const id of [
    "hub-event-goods-gallery-count",
    "hub-event-goods-gallery-add",
    "hub-event-goods-gallery-empty",
    "hub-event-goods-gallery-errors",
    "hub-event-goods-gallery-list",
    "hub-event-goods-gallery-import-text",
    "hub-event-goods-gallery-import-append",
    "hub-event-goods-gallery-import-replace",
    "hub-event-goods-gallery-import-result"
  ]) {
    nodes.set(id, new FakeNode("div"));
  }
  const document = { getElementById: (id: string) => nodes.get(id) ?? null, createElement: (tag: string) => new FakeNode(tag) };
  const sourceUrl = new FakeNode("input");
  sourceUrl.value = "https://www.stellive.me/notice/9";
  const catalog = enAdminMessages as Record<string, string>;
  const t = (key: string, params: Record<string, string | number> = {}) =>
    (catalog[key] ?? key).replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name] ?? `{${name}}`));
  const confirmCalls: string[] = [];
  const window = { confirm: (message: string) => { confirmCalls.push(message); return true; } };
  const api = new Function(
    "document", "window", "t", "adminCatalog", "hubEventFields",
    `${renderAdminGoodsGalleryScript()}\nreturn { bindGoodsGalleryForEvent, collectGoodsGalleryInput, showGoodsGalleryServerErrors, importGoodsGallery, addGoodsGalleryRow, rows: function () { return goodsGalleryRows; } };`
  )(document, window, t, catalog, { sourceUrl }) as {
    bindGoodsGalleryForEvent: (event: unknown) => void;
    collectGoodsGalleryInput: (input: Record<string, unknown>) => void;
    showGoodsGalleryServerErrors: (errors: unknown[]) => void;
    importGoodsGallery: (mode: string) => void;
    addGoodsGalleryRow: () => void;
    rows: () => Array<Record<string, unknown>>;
  };
  return { nodes, api, confirmCalls, node: (id: string) => nodes.get(id)! };
}

describe("admin goods gallery editor behavior", () => {
  it("omits goodsListImages until edited, then sends the ordered list (and [] to clear)", () => {
    const h = createGalleryHarness();
    h.api.bindGoodsGalleryForEvent({ goodsListImages: [{ policyState: "official_runtime_url", url: url1, sourceLabel: "공식 공지", sourceUrl: context.sourceUrl }] });
    const untouched: Record<string, unknown> = {};
    h.api.collectGoodsGalleryInput(untouched);
    expect(untouched).toEqual({});
    expect(h.node("hub-event-goods-gallery-count").textContent).toBe("1 / 20");

    h.node("hub-event-goods-gallery-import-text").value = `${url2}\n${url1}`;
    h.api.importGoodsGallery("append");
    const edited: Record<string, unknown> = {};
    h.api.collectGoodsGalleryInput(edited);
    expect(edited.goodsListImages).toEqual([
      { policyState: "official_runtime_url", kind: "md", url: url1, sourceLabel: "공식 공지", sourceUrl: context.sourceUrl },
      { policyState: "official_runtime_url", kind: "md", url: url2, altText: "MD 리스트 2", sourceLabel: "공식 공지", sourceUrl: "https://www.stellive.me/notice/9" },
      { policyState: "official_runtime_url", kind: "md", url: url1, altText: "MD 리스트 3", sourceLabel: "공식 공지", sourceUrl: "https://www.stellive.me/notice/9" }
    ]);
    // Duplicate URL warning is reported but does not block the import.
    expect(h.node("hub-event-goods-gallery-import-result").walk().some((n) => n.textContent === "Entry 2: url - This URL is already in the list.")).toBe(true);

    h.api.bindGoodsGalleryForEvent({});
    h.node("hub-event-goods-gallery-import-text").value = url1;
    h.api.importGoodsGallery("replace");
    h.api.rows().splice(0, 1);
    h.api.addGoodsGalleryRow();
    h.api.rows().splice(0, 1);
    const cleared: Record<string, unknown> = {};
    h.api.collectGoodsGalleryInput(cleared);
    expect(cleared.goodsListImages).toEqual([]);
  });

  it("renders a kind select per row and sends the edited kind", () => {
    const h = createGalleryHarness();
    h.api.bindGoodsGalleryForEvent({
      goodsListImages: [{ policyState: "official_runtime_url", kind: "bonus", url: url1, sourceLabel: "a", sourceUrl: context.sourceUrl }, { policyState: "official_runtime_url", url: url2, sourceLabel: "a", sourceUrl: context.sourceUrl }]
    });
    const [first, second] = h.node("hub-event-goods-gallery-list").children;
    const selects = (row: FakeNode) => row.walk().filter((n) => n.tag === "select");
    expect(selects(first)).toHaveLength(2);
    expect(selects(first).map((n) => n.value)).toContain("bonus");
    expect(selects(second).map((n) => n.value)).toContain("md");
    const kindSelect = selects(second).find((n) => n.value === "md")!;
    kindSelect.value = "bonus";
    kindSelect.fire("change");
    const input: Record<string, unknown> = {};
    h.api.collectGoodsGalleryInput(input);
    expect((input.goodsListImages as Array<{ kind: string }>).map((image) => image.kind)).toEqual(["bonus", "bonus"]);
  });

  it("does not add anything when the paste has errors, and blocks above 20 images", () => {
    const h = createGalleryHarness();
    h.api.bindGoodsGalleryForEvent({});
    h.node("hub-event-goods-gallery-import-text").value = "http://insecure.example/a.jpg";
    h.api.importGoodsGallery("append");
    expect(h.api.rows()).toHaveLength(0);
    expect(h.node("hub-event-goods-gallery-import-result").walk().some((n) => n.textContent.includes("Only https URLs are allowed."))).toBe(true);
    for (let index = 0; index < 25; index += 1) h.api.addGoodsGalleryRow();
    expect(h.api.rows()).toHaveLength(20);
    expect(h.node("hub-event-goods-gallery-add").disabled).toBe(true);
  });

  it("maps server errors to the matching row with aria-invalid and keeps operator text inert", () => {
    const h = createGalleryHarness();
    h.api.bindGoodsGalleryForEvent({
      goodsListImages: [
        { policyState: "official_runtime_url", url: url1, altText: "<img src=x onerror=alert(1)>", sourceLabel: "a", sourceUrl: context.sourceUrl },
        { policyState: "official_runtime_url", url: "https://example.com/z.jpg", sourceLabel: "a", sourceUrl: context.sourceUrl }
      ]
    });
    h.api.showGoodsGalleryServerErrors([
      { field: "goodsListImages.1.url", reason: "goods_list_image_host_not_allowed", message: "Host not allowed" },
      { field: "goodsListImages", reason: "goods_list_images_too_many", message: "Too many" },
      { field: "title", reason: "required", message: "unrelated" }
    ]);
    const rows = h.node("hub-event-goods-gallery-list").children;
    expect(rows).toHaveLength(2);
    expect(rows[0].attrs["aria-invalid"]).toBeUndefined();
    expect(rows[1].attrs["aria-invalid"]).toBe("true");
    const flagged = rows[1].walk().filter((n) => n.attrs["aria-invalid"] === "true" && n.tag === "input");
    expect(flagged).toHaveLength(1);
    expect(rows[1].walk().some((n) => n.textContent === "url - goods_list_image_host_not_allowed - Host not allowed")).toBe(true);
    expect(h.node("hub-event-goods-gallery-errors").children.map((n) => n.textContent)).toEqual(["goodsListImages - goods_list_images_too_many - Too many"]);
    const thumbs = rows[0].walk().filter((n) => n.tag === "img");
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0].attrs.referrerpolicy).toBe("no-referrer");
    expect((thumbs[0] as unknown as { loading: string }).loading).toBe("lazy");
    // Cleared by the next validation pass.
    h.api.showGoodsGalleryServerErrors([]);
    expect(h.node("hub-event-goods-gallery-list").children[1].walk().some((n) => n.textContent.includes("goods_list_image_host"))).toBe(false);
  });
});
