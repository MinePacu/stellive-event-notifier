import { describe, expect, it } from "vitest";
import { loadGoodsImportHelpers, loadGoodsImportParser } from "../src/admin/adminGoodsImport.js";

const parse = loadGoodsImportParser();

const members = [
  { id: "akane-lize", koreanName: "아카네 리제", englishName: "Akane Lize" },
  { id: "yuni", koreanName: "유니", englishName: "Yuni" }
];
const scheduleItems = [
  { id: "sched-1", label: "1차 판매", title: "1차 판매 시작" },
  { id: "sched-2", label: "2차 판매", title: "2차 판매 시작" },
  { id: "sched-3", label: "취소된 차수", title: "취소", cancelledAt: "2026-10-01T00:00:00.000Z" },
  { id: "sched-4", label: "", title: "라벨 없는 일정" }
];
const context = { members, scheduleItems };

describe("admin goods import parser", () => {
  it("parses a { goodsItems } JSON object and maps scheduleItemLabel to scheduleItemId", () => {
    const result = parse(
      JSON.stringify({
        goodsItems: [
          {
            name: "아크릴 키링",
            memberIds: ["akane-lize"],
            priceKrw: 8000,
            salesChannel: "both",
            isBonus: false,
            scheduleItemLabel: "2차 판매"
          }
        ]
      }),
      context
    );
    expect(result.format).toBe("json");
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        name: "아크릴 키링",
        memberIds: ["akane-lize"],
        priceKrw: 8000,
        salesChannel: "both",
        isBonus: false,
        scheduleItemId: "sched-2"
      }
    ]);
    expect(result.items[0]).not.toHaveProperty("scheduleItemLabel");
  });

  it("accepts a bare JSON array and strips server-owned keys", () => {
    const result = parse(
      JSON.stringify([
        { id: "old", createdAt: "x", updatedAt: "y", hubEventId: "z", cancelledAt: null, name: "포토카드", salesChannel: "onsite" }
      ]),
      context
    );
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([{ name: "포토카드", salesChannel: "onsite" }]);
  });

  it("falls back to the title of a label-less schedule item and ignores cancelled items", () => {
    const fallback = parse(JSON.stringify([{ name: "A", salesChannel: "online", scheduleItemLabel: "라벨 없는 일정" }]), context);
    expect(fallback.errors).toEqual([]);
    expect(fallback.items[0].scheduleItemId).toBe("sched-4");

    const cancelled = parse(JSON.stringify([{ name: "A", salesChannel: "online", scheduleItemLabel: "취소된 차수" }]), context);
    expect(cancelled.errors).toEqual([{ row: 0, field: "scheduleItemLabel", code: "schedule_label_unmatched", detail: "취소된 차수" }]);
  });

  it("reports unmatched labels and ambiguous labels per row", () => {
    const result = parse(
      JSON.stringify([
        { name: "A", salesChannel: "online", scheduleItemLabel: "3차 판매" },
        { name: "B", salesChannel: "online", scheduleItemLabel: "1차 판매" }
      ]),
      { members, scheduleItems: [...scheduleItems, { id: "sched-dup", label: "1차 판매", title: "dup" }] }
    );
    expect(result.errors).toEqual([
      { row: 0, field: "scheduleItemLabel", code: "schedule_label_unmatched", detail: "3차 판매" },
      { row: 1, field: "scheduleItemLabel", code: "schedule_label_ambiguous", detail: "1차 판매" }
    ]);
  });

  it("reports invalid JSON and wrong shapes as global errors", () => {
    expect(parse("{ nope", context).errors[0]).toMatchObject({ row: -1, code: "json_parse" });
    expect(parse('{"items": []}', context).errors).toEqual([{ row: -1, field: "", code: "json_shape", detail: "" }]);
    expect(parse("[1]", context).errors.map((error) => error.code)).toEqual(["item_not_object"]);
    expect(parse("   ", context).errors.map((error) => error.code)).toEqual(["empty"]);
    expect(parse("[]", context).errors.map((error) => error.code)).toEqual(["empty"]);
  });

  it("parses Korean-header TSV with price, channel, bonus, members and sales phase normalization", () => {
    const tsv = [
      "순서\t상품명\t그룹\t멤버\t가격\t가격 메모\t채널\t구매 제한\t제한 메모\t특전\t구매 URL\t판매 차수",
      "2\t포토카드 세트\t포카\t유니, 아카네 리제\t12,000\t배송비 별도\t현장·온라인\t3개\t1인 3개\t예\thttps://example.com/p/1\t1차 판매",
      "1\t키링\t\tYuni\t8000원\t\t온라인\t\t\tn\t\t"
    ].join("\n");
    const result = parse(tsv, context);
    expect(result.format).toBe("tsv");
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      { name: "키링", memberIds: ["yuni"], priceKrw: 8000, salesChannel: "online", isBonus: false },
      {
        name: "포토카드 세트",
        groupLabel: "포카",
        memberIds: ["yuni", "akane-lize"],
        priceKrw: 12000,
        priceNote: "배송비 별도",
        salesChannel: "both",
        purchaseLimit: 3,
        limitNote: "1인 3개",
        isBonus: true,
        purchaseUrl: "https://example.com/p/1",
        scheduleItemId: "sched-1"
      }
    ]);
  });

  it("parses TSV with JSON-key headers, CRLF line endings and quoted cells", () => {
    const tsv = ["name\tsalesChannel\tpriceNote\tisBonus", '"A ""special"" item"\tonsite\t"line1\nline2"\ttrue'].join("\r\n");
    const result = parse(tsv, context);
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([{ name: 'A "special" item', salesChannel: "onsite", priceNote: "line1\nline2", isBonus: true }]);
  });

  it("keeps row order when no order column is given and remaps error rows when it reorders", () => {
    const ordered = parse(["순서\t상품명\t채널\t가격", "2\tB\t현장\tabc", "1\tA\t현장\t100"].join("\n"), context);
    expect(ordered.items.map((item) => item.name)).toEqual(["A", "B"]);
    expect(ordered.errors).toEqual([{ row: 1, field: "priceKrw", code: "price_invalid", detail: "abc" }]);

    const unordered = parse(["상품명\t채널", "B\t현장", "A\t현장"].join("\n"), context);
    expect(unordered.items.map((item) => item.name)).toEqual(["B", "A"]);
  });

  it("reports TSV header and cell errors without silently dropping data", () => {
    const header = parse("상품명\t이상한열\t상품명\nA\tb\tc", context);
    expect(header.errors.map((error) => error.code)).toEqual(["unknown_column", "duplicate_column"]);
    expect(parse("가격\n100", context).errors.map((error) => error.code)).toEqual(["missing_name_column"]);

    const cells = parse(
      ["상품명\t멤버\t가격\t채널\t구매 제한\t특전", "A\t없는멤버\t천원\t배송\tx\t글쎄", "\t\t\t\t\t"].join("\n"),
      context
    );
    expect(cells.errors).toEqual([
      { row: 0, field: "memberIds", code: "member_unknown", detail: "없는멤버" },
      { row: 0, field: "priceKrw", code: "price_invalid", detail: "천원" },
      { row: 0, field: "salesChannel", code: "channel_invalid", detail: "배송" },
      { row: 0, field: "purchaseLimit", code: "number_invalid", detail: "x" },
      { row: 0, field: "isBonus", code: "bool_invalid", detail: "글쎄" }
    ]);
    expect(parse("상품명\t채널\nA\t현장\tzzz", context).errors).toEqual([{ row: 0, field: "", code: "extra_cells", detail: "" }]);
    expect(parse("상품명\n\n", context).errors.map((error) => error.code)).toEqual(["empty"]);
  });

  it("flags rows without a name and caps the item count", () => {
    expect(parse(JSON.stringify([{ salesChannel: "online" }]), context).errors).toEqual([
      { row: 0, field: "name", code: "name_required", detail: "" }
    ]);
    const many = JSON.stringify(Array.from({ length: 201 }, (_, index) => ({ name: `item ${index}`, salesChannel: "online" })));
    expect(parse(many, context).errors).toEqual([{ row: -1, field: "", code: "too_many", detail: "200" }]);
  });

  it("passes member ids through when the catalog is unavailable but cannot resolve names", () => {
    const withoutCatalog = { members: null, scheduleItems };
    const json = parse(JSON.stringify([{ name: "A", salesChannel: "online", memberIds: ["unknown-id"] }]), withoutCatalog);
    expect(json.errors).toEqual([]);
    expect(json.items[0].memberIds).toEqual(["unknown-id"]);
  });

  it("resolves unambiguous short names and rejects ambiguous ones", () => {
    const catalog = [
      { id: "ayatsuno-yuni", koreanName: "아야츠노 유니", englishName: "Ayatsuno Yuni" },
      { id: "akane-lize", koreanName: "아카네 리제", englishName: "Akane Lize" },
      { id: "other-lize", koreanName: "다른 리제", englishName: "Other Lize" }
    ];
    const result = parse(JSON.stringify([{ name: "A", salesChannel: "online", memberIds: ["유니", "리제", "Yuni"] }]), { members: catalog, scheduleItems });
    expect(result.items[0].memberIds).toEqual(["ayatsuno-yuni"]);
    expect(result.errors).toEqual([{ row: 0, field: "memberIds", code: "member_unknown", detail: "리제" }]);
  });

  it("deduplicates repeated members and resolves English names case-insensitively", () => {
    const result = parse(JSON.stringify([{ name: "A", salesChannel: "online", memberIds: ["유니", "YUNI", "akane lize", "zzz"] }]), context);
    expect(result.items[0].memberIds).toEqual(["yuni", "akane-lize"]);
    expect(result.errors).toEqual([{ row: 0, field: "memberIds", code: "member_unknown", detail: "zzz" }]);
  });
});

describe("admin goods import helpers", () => {
  const helpers = loadGoodsImportHelpers();

  it("maps server bulk-replace error paths to rows and fields", () => {
    expect(helpers.parseGoodsServerErrorField("items[3].priceKrw")).toEqual({ row: 3, field: "priceKrw" });
    expect(helpers.parseGoodsServerErrorField("items[12].memberIds[2]")).toEqual({ row: 12, field: "memberIds[2]" });
    expect(helpers.parseGoodsServerErrorField("items[0]")).toEqual({ row: 0, field: "" });
    expect(helpers.parseGoodsServerErrorField("goodsItems")).toBeNull();
    expect(helpers.parseGoodsServerErrorField("priceKrw")).toBeNull();
  });

  it("strips list indexes so memberIds[2] addresses the memberIds control", () => {
    expect(helpers.goodsFieldControlName("memberIds[2]")).toBe("memberIds");
    expect(helpers.goodsFieldControlName("priceKrw")).toBe("priceKrw");
  });
});
