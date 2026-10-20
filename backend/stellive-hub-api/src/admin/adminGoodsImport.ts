/**
 * Client-side parser for the goods list paste import in the admin console.
 *
 * The parser is plain ES5-style JavaScript kept as a string so the exact same source is both embedded in the
 * console's inline script (renderAdminGoodsImportScript) and executed by unit tests (loadGoodsImportParser).
 * It must stay free of backticks and template placeholders; String.raw keeps its backslashes intact.
 *
 * parseGoodsImport(text, context) -> { format: "json" | "tsv" | "", items, errors }
 *   context.scheduleItems: [{ id, label, title, cancelledAt }]  (used to resolve scheduleItemLabel / sales phase)
 *   context.members: [{ id, koreanName, englishName }] | null    (null = catalog unavailable, ids pass through)
 *   items[i]: bulk-replace write item (no id / sortOrder / cancelledAt); index-aligned with raw rows, so
 *             errors[].row (0-based item index, -1 for global errors) matches the server's items[i] paths.
 *   errors[]: { row, field, code, detail }  -- codes are mapped to localized text by the console.
 */
export const goodsImportScriptSource = String.raw`
function parseGoodsImport(text, context) {
  var ctx = context || {};
  var scheduleItems = Array.isArray(ctx.scheduleItems) ? ctx.scheduleItems : [];
  var members = Array.isArray(ctx.members) ? ctx.members : null;
  var maxItems = 200;
  var errors = [];
  function addError(row, field, code, detail) {
    errors.push({ row: row, field: field || "", code: code, detail: detail === undefined || detail === null ? "" : String(detail) });
  }
  function done(format, items) {
    return { format: format, items: items, errors: errors };
  }

  var source = String(text === undefined || text === null ? "" : text).replace(/^﻿/, "");
  var trimmed = source.trim();
  if (!trimmed) {
    addError(-1, "", "empty");
    return done("", []);
  }

  var rawRows;
  var format;
  if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
    format = "json";
    var parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      addError(-1, "", "json_parse", error && error.message ? error.message : "");
      return done(format, []);
    }
    var list = Array.isArray(parsed) ? parsed : (parsed && !Array.isArray(parsed) && Array.isArray(parsed.goodsItems) ? parsed.goodsItems : null);
    if (!list) {
      addError(-1, "", "json_shape");
      return done(format, []);
    }
    rawRows = list;
  } else {
    format = "tsv";
    rawRows = tsvToRows(trimmed);
    if (!rawRows) return done(format, []);
  }

  if (rawRows.length === 0) {
    addError(-1, "", "empty");
    return done(format, []);
  }
  if (rawRows.length > maxItems) addError(-1, "", "too_many", maxItems);

  var normalized = rawRows.map(function (raw, index) { return normalizeItem(raw, index); });
  var orders = normalized.map(function (entry) { return entry.order; });
  var items = normalized.map(function (entry) { return entry.item; });
  if (orders.every(function (value) { return typeof value === "number"; })) {
    var indexes = items.map(function (_item, index) { return index; });
    indexes.sort(function (left, right) { return orders[left] - orders[right] || left - right; });
    // Explicit order values reorder the items; error rows are remapped so they keep pointing at the right item.
    if (indexes.some(function (value, position) { return value !== position; })) {
      var remap = {};
      indexes.forEach(function (oldIndex, newIndex) { remap[oldIndex] = newIndex; });
      errors.forEach(function (error) { if (error.row >= 0 && Object.prototype.hasOwnProperty.call(remap, error.row)) error.row = remap[error.row]; });
      items = indexes.map(function (oldIndex) { return items[oldIndex]; });
    }
  }
  return done(format, items);

  function tsvToRows(input) {
    var table = parseDelimited(input).filter(function (cells) {
      return cells.some(function (cell) { return cell.trim() !== ""; });
    });
    if (table.length === 0) {
      addError(-1, "", "empty");
      return null;
    }
    var headerCells = table[0].map(function (cell) { return cell.trim(); });
    var keys = [];
    var seen = {};
    var headerOk = true;
    headerCells.forEach(function (header) {
      var key = headerKey(header);
      if (!key) {
        addError(-1, header, "unknown_column", header);
        headerOk = false;
        keys.push("");
        return;
      }
      if (seen[key]) {
        addError(-1, header, "duplicate_column", header);
        headerOk = false;
      }
      seen[key] = true;
      keys.push(key);
    });
    if (!seen.name) {
      addError(-1, "name", "missing_name_column");
      headerOk = false;
    }
    if (!headerOk) return null;
    var rows = [];
    table.slice(1).forEach(function (cells, rowIndex) {
      var row = {};
      cells.forEach(function (cell, cellIndex) {
        var value = cell.trim();
        if (cellIndex >= keys.length) {
          if (value) row.__extraCells = true;
          return;
        }
        if (value) row[keys[cellIndex]] = value;
      });
      rows.push(row);
    });
    return rows;
  }

  function parseDelimited(input) {
    var table = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    var cellStart = true;
    for (var i = 0; i < input.length; i++) {
      var ch = input.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (input.charAt(i + 1) === '"') { cell += '"'; i++; } else { inQuotes = false; }
        } else {
          cell += ch;
        }
        continue;
      }
      if (ch === '"' && cellStart) { inQuotes = true; cellStart = false; continue; }
      if (ch === "\t") { row.push(cell); cell = ""; cellStart = true; continue; }
      if (ch === "\r") continue;
      if (ch === "\n") { row.push(cell); table.push(row); row = []; cell = ""; cellStart = true; continue; }
      cell += ch;
      cellStart = false;
    }
    row.push(cell);
    table.push(row);
    return table;
  }

  function headerKey(header) {
    var normalizedHeader = String(header).replace(/[\s_\-]/g, "").toLowerCase();
    var aliases = {
      "순서": "sortOrder", "order": "sortOrder", "sortorder": "sortOrder",
      "상품명": "name", "상품": "name", "이름": "name", "name": "name",
      "그룹": "groupLabel", "grouplabel": "groupLabel",
      "멤버": "memberIds", "memberids": "memberIds", "members": "memberIds",
      "가격": "priceKrw", "pricekrw": "priceKrw", "price": "priceKrw",
      "가격메모": "priceNote", "pricenote": "priceNote",
      "채널": "salesChannel", "판매채널": "salesChannel", "saleschannel": "salesChannel",
      "구매제한": "purchaseLimit", "purchaselimit": "purchaseLimit",
      "제한메모": "limitNote", "limitnote": "limitNote",
      "특전": "isBonus", "isbonus": "isBonus",
      "구매url": "purchaseUrl", "purchaseurl": "purchaseUrl",
      "판매차수": "scheduleItemLabel", "scheduleitemlabel": "scheduleItemLabel",
      "scheduleitemid": "scheduleItemId"
    };
    return Object.prototype.hasOwnProperty.call(aliases, normalizedHeader) ? aliases[normalizedHeader] : "";
  }

  function parseCount(value, suffixPattern) {
    var stripped = String(value).replace(/[\s,₩]/g, "").replace(suffixPattern, "");
    return /^\d+$/.test(stripped) ? Number(stripped) : null;
  }

  function mapChannel(value) {
    var key = String(value).replace(/\s/g, "").replace(/[\u00B7\u318D\u30FB\u2022,+&]/g, "/").toLowerCase();
    var table = {
      "현장": "onsite", "오프라인": "onsite", "onsite": "onsite",
      "온라인": "online", "online": "online",
      "현장/온라인": "both", "온라인/현장": "both", "둘다": "both", "both": "both"
    };
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
  }

  function mapBool(value) {
    var key = String(value).replace(/[\s]/g, "").toLowerCase();
    if (["예", "네", "y", "yes", "true", "1", "o", "특전", "있음"].indexOf(key) >= 0) return true;
    if (["아니오", "아니요", "아니", "n", "no", "false", "0", "x", "없음"].indexOf(key) >= 0) return false;
    return null;
  }

  function resolveMember(token) {
    if (!members) return token;
    var lower = token.toLowerCase();
    var found = members.filter(function (member) { return String(member.id).toLowerCase() === lower; });
    if (found.length === 0) found = members.filter(function (member) { return member.koreanName === token; });
    if (found.length === 0) found = members.filter(function (member) { return String(member.englishName || "").toLowerCase() === lower; });
    if (found.length === 0) {
      // Short names: "유니" for "아야츠노 유니" (one whitespace-separated part of the name, and only if unambiguous).
      found = members.filter(function (member) {
        return String(member.koreanName || "").split(/\s+/).indexOf(token) >= 0 || String(member.englishName || "").toLowerCase().split(/\s+/).indexOf(lower) >= 0;
      });
    }
    return found.length === 1 ? found[0].id : null;
  }

  function resolveScheduleLabel(label) {
    var active = scheduleItems.filter(function (item) { return !item.cancelledAt; });
    var matches = active.filter(function (item) { return String(item.label || "").trim() === label; });
    if (matches.length === 0) matches = active.filter(function (item) { return !String(item.label || "").trim() && String(item.title || "").trim() === label; });
    return matches;
  }

  function normalizeItem(raw, index) {
    var out = {};
    var order = null;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      addError(index, "", "item_not_object");
      return { item: out, order: null };
    }
    if (raw.__extraCells) addError(index, "", "extra_cells");
    var dropped = { id: 1, createdAt: 1, updatedAt: 1, hubEventId: 1, cancelledAt: 1, __extraCells: 1 };
    Object.keys(raw).forEach(function (key) {
      if (dropped[key]) return;
      var value = raw[key];
      if (key === "sortOrder") {
        if (typeof value === "number" && isFinite(value)) order = value;
        else if (typeof value === "string" && value.trim() !== "") {
          var parsedOrder = parseCount(value, /$^/);
          if (parsedOrder === null) addError(index, key, "number_invalid", value);
          else order = parsedOrder;
        } else if (value !== null && value !== undefined && value !== "") addError(index, key, "number_invalid", value);
        return;
      }
      if (key === "scheduleItemLabel") {
        if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return;
        if (typeof value !== "string") { addError(index, key, "schedule_label_unmatched", value); return; }
        var label = value.trim();
        var matches = resolveScheduleLabel(label);
        if (matches.length === 0) addError(index, key, "schedule_label_unmatched", label);
        else if (matches.length > 1) addError(index, key, "schedule_label_ambiguous", label);
        else if (out.scheduleItemId && out.scheduleItemId !== matches[0].id) addError(index, key, "schedule_conflict", label);
        else out.scheduleItemId = matches[0].id;
        return;
      }
      if (key === "scheduleItemId") {
        if (typeof value === "string" && value.trim() === "") return;
        if (out.scheduleItemId && value && out.scheduleItemId !== value) { addError(index, "scheduleItemLabel", "schedule_conflict", value); return; }
        if (value !== null && value !== undefined) out.scheduleItemId = value;
        return;
      }
      if (key === "memberIds") {
        var tokens;
        if (Array.isArray(value)) tokens = value;
        else if (typeof value === "string") tokens = value.split(/[,;，、]/);
        else if (value === null || value === undefined) return;
        else { addError(index, key, "member_unknown", value); return; }
        var ids = [];
        tokens.forEach(function (token) {
          if (token !== null && token !== undefined && typeof token !== "string") { addError(index, key, "member_unknown", token); return; }
          var text = typeof token === "string" ? token.trim() : "";
          if (!text) return;
          var id = resolveMember(text);
          if (id === null) { addError(index, key, "member_unknown", text); return; }
          if (ids.indexOf(id) < 0) ids.push(id);
        });
        out.memberIds = ids;
        return;
      }
      if (typeof value === "string") {
        var cell = value.trim();
        if (cell === "") return;
        if (key === "priceKrw") {
          var price = parseCount(cell, /(원|krw)$/i);
          if (price === null) addError(index, key, "price_invalid", cell); else out[key] = price;
        } else if (key === "purchaseLimit") {
          var limit = parseCount(cell, /(개|명|점)$/);
          if (limit === null) addError(index, key, "number_invalid", cell); else out[key] = limit;
        } else if (key === "salesChannel") {
          var channel = mapChannel(cell);
          if (channel === null) addError(index, key, "channel_invalid", cell); else out[key] = channel;
        } else if (key === "isBonus") {
          var flag = mapBool(cell);
          if (flag === null) addError(index, key, "bool_invalid", cell); else out[key] = flag;
        } else {
          out[key] = cell;
        }
        return;
      }
      out[key] = value;
    });
    if (typeof out.name !== "string" || out.name === "") addError(index, "name", "name_required");
    return { item: out, order: order };
  }
}

/** Maps a server bulk-replace error field ("items[3].priceKrw") to { row: 3, field: "priceKrw" }; null if not an item path. */
function parseGoodsServerErrorField(field) {
  var match = /^items\[(\d+)\](?:\.(.+))?$/.exec(String(field || ""));
  return match ? { row: Number(match[1]), field: match[2] || "" } : null;
}

/** Strips list indexes from a field path so "memberIds[2]" addresses the memberIds control. */
function goodsFieldControlName(field) {
  return String(field || "").replace(/\[\d+\].*$/, "");
}
`;

/** Source embedded into the console's inline script. */
export function renderAdminGoodsImportScript(): string {
  return goodsImportScriptSource;
}

/** Test helper: evaluates every function of the embedded source. */
export function loadGoodsImportHelpers(): {
  parseGoodsImport: ReturnType<typeof loadGoodsImportParser>;
  parseGoodsServerErrorField: (field: string) => { row: number; field: string } | null;
  goodsFieldControlName: (field: string) => string;
} {
  return new Function(
    `${goodsImportScriptSource}\nreturn { parseGoodsImport, parseGoodsServerErrorField, goodsFieldControlName };`
  )() as ReturnType<typeof loadGoodsImportHelpers>;
}

/** Test helper: evaluates the embedded source exactly as the browser would. */
export function loadGoodsImportParser(): (text: string, context?: Record<string, unknown>) => {
  format: "json" | "tsv" | "";
  items: Array<Record<string, unknown>>;
  errors: Array<{ row: number; field: string; code: string; detail: string }>;
} {
  return new Function(`${goodsImportScriptSource}\nreturn parseGoodsImport;`)() as ReturnType<typeof loadGoodsImportParser>;
}
