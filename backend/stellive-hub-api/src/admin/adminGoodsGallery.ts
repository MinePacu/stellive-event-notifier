/**
 * Admin console editor for the hub event "official MD list image gallery" (HubEvent.goodsListImages).
 *
 * Everything gallery-specific for the console lives in this file so the feature can be rolled back by removing the
 * few call sites in adminConsoleHtml.ts (listed in docs/HUB_EVENT_GOODS_ITEMS_DESIGN.md).
 *
 * Two plain-JavaScript sources are kept as strings (String.raw keeps backslashes intact; the big console template
 * literal in adminConsoleHtml.ts would drop them, so regexes must stay here). Neither may contain backticks or
 * template placeholders:
 *   - goodsGalleryParserSource: pure functions, executed by unit tests via new Function (loadGoodsGalleryHelpers).
 *   - goodsGalleryUiSource: DOM wiring; depends on console globals (adminCatalog, t, hubEventFields).
 *
 * parseGoodsGalleryImport(text, context) -> { format: "json" | "lines" | "", images, errors, warnings }
 *   context: { sourceUrl, sourceLabel, startIndex, existingUrls, existingKinds }
 *   images[i]: { policyState, kind, url, altText, sourceLabel, sourceUrl } (strings; empty string = unset; kind md|bonus)
 *   errors[] / warnings[]: { index, field, code, detail } -- index is the 0-based pasted entry (-1 = global);
 *   codes are mapped to localized text by the console (goodsGallery.err.* / goodsGallery.warn.*).
 */
export const goodsGalleryParserSource = String.raw`
var GOODS_GALLERY_MAX = 20;
var GOODS_GALLERY_DEFAULT_LABEL = "공식 공지";
var GOODS_GALLERY_ALT_PREFIXES = { md: "MD 리스트 ", bonus: "특전 리스트 " };
var GOODS_GALLERY_KINDS = ["md", "bonus"];
var GOODS_GALLERY_POLICY_STATES = ["none", "official_runtime_url", "third_party_allowed", "verify_required", "blocked"];

/** Same host rule as the server: stellive.me, any subdomain of it, or pbs.twimg.com. */
function isGoodsGalleryAllowedHost(hostname) {
  var host = String(hostname || "").toLowerCase();
  return host === "pbs.twimg.com" || host === "stellive.me" || /\.stellive\.me$/.test(host);
}

function goodsGalleryParseUrl(value) {
  if (!value || /\s/.test(value)) return null;
  try {
    return new URL(value);
  } catch (error) {
    return null;
  }
}

/**
 * Client-side checks for an ordered list of images. Index-aligned with the input; null entries are skipped.
 * existingUrls: urls already in the list that precede these images (duplicate detection only).
 */
function goodsGalleryCheckImages(images, existingUrls) {
  var errors = [];
  var warnings = [];
  var seen = {};
  (Array.isArray(existingUrls) ? existingUrls : []).forEach(function (url) {
    var key = String(url || "").trim();
    if (key) seen[key] = true;
  });
  function addError(index, field, code, detail) {
    errors.push({ index: index, field: field, code: code, detail: detail === undefined || detail === null ? "" : String(detail) });
  }
  function addWarning(index, field, code, detail) {
    warnings.push({ index: index, field: field, code: code, detail: detail === undefined || detail === null ? "" : String(detail) });
  }
  (images || []).forEach(function (image, index) {
    if (!image) return;
    var policy = image.policyState || "";
    if (policy === "none") return;
    var url = String(image.url || "").trim();
    var needsSource = policy === "official_runtime_url" || policy === "third_party_allowed";
    if (!url) {
      addError(index, "url", "url_required");
    } else {
      var parsed = goodsGalleryParseUrl(url);
      if (!parsed) {
        addError(index, "url", "url_invalid");
      } else if (parsed.protocol !== "https:") {
        addError(index, "url", "url_not_https");
      } else if (policy === "official_runtime_url" && !isGoodsGalleryAllowedHost(parsed.hostname)) {
        addWarning(index, "url", "host_not_allowed", parsed.hostname);
      }
      if (seen[url]) addWarning(index, "url", "duplicate_url");
      seen[url] = true;
    }
    var sourceUrl = String(image.sourceUrl || "").trim();
    if (sourceUrl) {
      var parsedSource = goodsGalleryParseUrl(sourceUrl);
      if (!parsedSource || parsedSource.protocol !== "https:") addError(index, "sourceUrl", "source_url_not_https");
    } else if (needsSource) {
      addError(index, "sourceUrl", "source_url_required");
    }
    if (needsSource && !String(image.sourceLabel || "").trim()) addError(index, "sourceLabel", "source_label_required");
  });
  return { errors: errors, warnings: warnings };
}

function parseGoodsGalleryImport(text, context) {
  var ctx = context || {};
  var startIndex = typeof ctx.startIndex === "number" && ctx.startIndex > 0 ? ctx.startIndex : 0;
  var defaultSourceLabel = ctx.sourceLabel === undefined || ctx.sourceLabel === null ? GOODS_GALLERY_DEFAULT_LABEL : String(ctx.sourceLabel);
  var defaultSourceUrl = ctx.sourceUrl ? String(ctx.sourceUrl).trim() : "";
  // Alt text numbering is per kind and continues after the rows already in the editor.
  var kindCounts = { md: 0, bonus: 0 };
  if (Array.isArray(ctx.existingKinds)) {
    ctx.existingKinds.forEach(function (kind) { kindCounts[kind === "bonus" ? "bonus" : "md"] += 1; });
  } else {
    kindCounts.md = startIndex;
  }
  var errors = [];
  function addError(index, field, code, detail) {
    errors.push({ index: index, field: field, code: code, detail: detail === undefined || detail === null ? "" : String(detail) });
  }
  function done(format, images, warnings) {
    return { format: format, images: images, errors: errors, warnings: warnings || [] };
  }

  var source = String(text === undefined || text === null ? "" : text).replace(/^﻿/, "");
  var trimmed = source.trim();
  if (!trimmed) {
    addError(-1, "", "empty");
    return done("", []);
  }

  var rawEntries;
  var format;
  if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
    format = "json";
    var parsedJson;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch (error) {
      addError(-1, "", "json_parse", error && error.message ? error.message : "");
      return done(format, []);
    }
    if (Array.isArray(parsedJson)) {
      rawEntries = parsedJson;
    } else if (parsedJson && typeof parsedJson === "object" && Array.isArray(parsedJson.goodsListImages)) {
      rawEntries = parsedJson.goodsListImages;
    } else {
      addError(-1, "", "json_shape");
      return done(format, []);
    }
  } else {
    format = "lines";
    rawEntries = trimmed.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(function (line) { return line !== ""; });
  }

  if (startIndex + rawEntries.length > GOODS_GALLERY_MAX) addError(-1, "", "too_many", GOODS_GALLERY_MAX);

  var textFields = ["url", "altText", "sourceLabel", "sourceUrl"];
  var images = rawEntries.map(function (raw, index) {
    var entry;
    if (typeof raw === "string") {
      entry = { url: raw };
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      entry = raw;
    } else {
      addError(index, "", "item_not_object");
      return null;
    }
    var policyState = "official_runtime_url";
    if (entry.policyState !== undefined && entry.policyState !== null && entry.policyState !== "") {
      if (GOODS_GALLERY_POLICY_STATES.indexOf(entry.policyState) < 0) {
        addError(index, "policyState", "policy_invalid", entry.policyState);
      } else {
        policyState = entry.policyState;
      }
    }
    var kind = "md";
    if (entry.kind !== undefined && entry.kind !== null && entry.kind !== "") {
      if (GOODS_GALLERY_KINDS.indexOf(entry.kind) < 0) {
        addError(index, "kind", "kind_invalid", entry.kind);
      } else {
        kind = entry.kind;
      }
    }
    kindCounts[kind] += 1;
    var image = { policyState: policyState, kind: kind, url: "", altText: "", sourceLabel: "", sourceUrl: "" };
    textFields.forEach(function (field) {
      var value = entry[field];
      if (value === undefined || value === null) return;
      if (typeof value !== "string") {
        addError(index, field, "field_not_string");
        return;
      }
      image[field] = value.trim();
    });
    if (policyState !== "none") {
      if (!image.altText) image.altText = GOODS_GALLERY_ALT_PREFIXES[kind] + kindCounts[kind];
      if (!image.sourceLabel) image.sourceLabel = defaultSourceLabel;
      if (!image.sourceUrl) image.sourceUrl = defaultSourceUrl;
    }
    return image;
  });

  var checked = goodsGalleryCheckImages(images, ctx.existingUrls);
  checked.errors.forEach(function (error) { errors.push(error); });
  return done(format, images, checked.warnings);
}

/** Builds the PUT body value for goodsListImages from editor rows (empty strings are omitted). */
function buildGoodsGalleryPayload(rows) {
  return (rows || []).map(function (row) {
    var out = { policyState: row.policyState || "official_runtime_url" };
    if (out.policyState === "none") return out;
    out.kind = row.kind === "bonus" ? "bonus" : "md";
    ["url", "altText", "sourceLabel", "sourceUrl"].forEach(function (field) {
      var value = String(row[field] === undefined || row[field] === null ? "" : row[field]).trim();
      if (value) out[field] = value;
    });
    return out;
  });
}

/** Maps a server error field ("goodsListImages.3.url") to { row: 3, field: "url" }; row -1 for the list itself; null otherwise. */
function parseGoodsGalleryServerErrorField(field) {
  var match = /^goodsListImages(?:\.(\d+)(?:\.(.+))?)?$/.exec(String(field || ""));
  if (!match) return null;
  return { row: match[1] === undefined ? -1 : Number(match[1]), field: match[2] || "" };
}
`;

/**
 * DOM wiring for the gallery editor. Rows are plain objects; every operator-controlled string reaches the DOM through
 * textContent / .value / setAttribute only (never innerHTML). Thumbnails are loaded by the operator's browser
 * (lazy, no-referrer); nothing is fetched server-side.
 */
export const goodsGalleryUiSource = String.raw`
var goodsGalleryRows = [];
var goodsGalleryRefs = [];
var goodsGalleryDirty = false;
var goodsGalleryGlobalErrors = [];

function goodsGalleryNode(id) {
  return document.getElementById(id);
}

function newGoodsGalleryRow(image) {
  var source = image || {};
  return {
    policyState: source.policyState || "official_runtime_url",
    kind: source.kind === "bonus" ? "bonus" : "md",
    url: source.url || "",
    altText: source.altText || "",
    sourceLabel: source.sourceLabel || "",
    sourceUrl: source.sourceUrl || "",
    serverErrors: []
  };
}

function goodsGalleryIssueText(kind, issue) {
  var key = "goodsGallery." + kind + "." + issue.code;
  return Object.prototype.hasOwnProperty.call(adminCatalog, key) ? t(key, { detail: issue.detail }) : t("goodsGallery." + kind + ".unknown");
}

function setGoodsGalleryThumb(refs, url) {
  var value = String(url || "").trim();
  refs.thumb.classList.remove("is-broken");
  if (/^https:\/\//i.test(value)) {
    refs.img.src = value;
    refs.img.hidden = false;
  } else {
    refs.img.removeAttribute("src");
    refs.img.hidden = true;
  }
}

function refreshGoodsGalleryMessages() {
  var checked = goodsGalleryCheckImages(goodsGalleryRows, []);
  var count = goodsGalleryRows.length;
  goodsGalleryNode("hub-event-goods-gallery-count").textContent = t("goodsGallery.count", { count: count, max: GOODS_GALLERY_MAX });
  goodsGalleryNode("hub-event-goods-gallery-add").disabled = count >= GOODS_GALLERY_MAX;
  goodsGalleryNode("hub-event-goods-gallery-empty").hidden = count > 0;
  var globalRoot = goodsGalleryNode("hub-event-goods-gallery-errors");
  globalRoot.replaceChildren();
  goodsGalleryGlobalErrors.forEach(function (text) {
    var item = document.createElement("li");
    item.className = "is-error";
    item.textContent = text;
    globalRoot.appendChild(item);
  });
  goodsGalleryRefs.forEach(function (refs, index) {
    var row = goodsGalleryRows[index];
    var controlNames = Object.keys(refs.controls);
    controlNames.forEach(function (name) { refs.controls[name].removeAttribute("aria-invalid"); });
    refs.messages.replaceChildren();
    var invalid = false;
    function addMessage(className, field, text) {
      var item = document.createElement("li");
      item.className = className;
      item.textContent = text;
      refs.messages.appendChild(item);
      if (className === "is-error") {
        invalid = true;
        if (field && refs.controls[field]) refs.controls[field].setAttribute("aria-invalid", "true");
      }
    }
    checked.errors.forEach(function (issue) {
      if (issue.index === index) addMessage("is-error", issue.field, goodsGalleryIssueText("err", issue));
    });
    checked.warnings.forEach(function (issue) {
      if (issue.index === index) addMessage("is-warning", issue.field, goodsGalleryIssueText("warn", issue));
    });
    row.serverErrors.forEach(function (entry) { addMessage("is-error", entry.field, entry.text); });
    if (invalid) refs.root.setAttribute("aria-invalid", "true"); else refs.root.removeAttribute("aria-invalid");
    refs.up.disabled = index === 0;
    refs.down.disabled = index === goodsGalleryRows.length - 1;
  });
}

function createGoodsGalleryField(labelKey, control) {
  var wrapper = document.createElement("label");
  wrapper.className = "hub-event-gallery-field";
  var caption = document.createElement("span");
  caption.textContent = t(labelKey);
  wrapper.append(caption, control);
  return wrapper;
}

function createGoodsGalleryButton(glyph, labelKey, handler) {
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = glyph;
  button.setAttribute("aria-label", t(labelKey));
  button.title = t(labelKey);
  button.addEventListener("click", handler);
  return button;
}

function moveGoodsGalleryRow(index, delta) {
  var target = index + delta;
  if (target < 0 || target >= goodsGalleryRows.length) return;
  var moved = goodsGalleryRows.splice(index, 1)[0];
  goodsGalleryRows.splice(target, 0, moved);
  goodsGalleryDirty = true;
  renderGoodsGallery();
}

function renderGoodsGallery() {
  var list = goodsGalleryNode("hub-event-goods-gallery-list");
  list.replaceChildren();
  goodsGalleryRefs = goodsGalleryRows.map(function (row, index) {
    var root = document.createElement("div");
    root.className = "hub-event-gallery-row";
    var thumb = document.createElement("div");
    thumb.className = "hub-event-gallery-thumb";
    var img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = "";
    img.setAttribute("referrerpolicy", "no-referrer");
    img.addEventListener("error", function () { thumb.classList.add("is-broken"); });
    img.addEventListener("load", function () { thumb.classList.remove("is-broken"); });
    var brokenNote = document.createElement("span");
    brokenNote.className = "hub-event-gallery-thumb-note";
    brokenNote.textContent = t("goodsGallery.thumbFailed");
    thumb.append(img, brokenNote);

    var head = document.createElement("div");
    head.className = "hub-event-gallery-head";
    var title = document.createElement("strong");
    title.textContent = t("goodsGallery.rowLabel", { n: index + 1 });
    var actions = document.createElement("div");
    actions.className = "hub-event-gallery-actions";
    var up = createGoodsGalleryButton("↑", "goodsGallery.moveUp", function () { moveGoodsGalleryRow(index, -1); });
    var down = createGoodsGalleryButton("↓", "goodsGallery.moveDown", function () { moveGoodsGalleryRow(index, 1); });
    var remove = createGoodsGalleryButton("✕", "goodsGallery.remove", function () {
      goodsGalleryRows.splice(index, 1);
      goodsGalleryDirty = true;
      renderGoodsGallery();
    });
    actions.append(up, down, remove);
    head.append(title, actions);

    var controls = {};
    var fields = document.createElement("div");
    fields.className = "hub-event-gallery-fields";
    function bindControl(name, control) {
      controls[name] = control;
      control.value = row[name];
      var onEdit = function () {
        row[name] = control.value;
        row.serverErrors = row.serverErrors.filter(function (entry) { return entry.field !== name; });
        goodsGalleryDirty = true;
        refreshGoodsGalleryMessages();
      };
      control.addEventListener("input", onEdit);
      if (name === "url") control.addEventListener("change", function () { setGoodsGalleryThumb(goodsGalleryRefs[goodsGalleryRows.indexOf(row)], row.url); });
      if (name === "policyState" || name === "kind") control.addEventListener("change", onEdit);
    }
    var urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.autocomplete = "off";
    urlInput.spellcheck = false;
    bindControl("url", urlInput);
    var altInput = document.createElement("input");
    altInput.autocomplete = "off";
    bindControl("altText", altInput);
    var policySelect = document.createElement("select");
    GOODS_GALLERY_POLICY_STATES.forEach(function (state) {
      var option = document.createElement("option");
      option.value = state;
      option.textContent = t("goodsGallery.policy." + state);
      policySelect.appendChild(option);
    });
    bindControl("policyState", policySelect);
    var kindSelect = document.createElement("select");
    GOODS_GALLERY_KINDS.forEach(function (kind) {
      var option = document.createElement("option");
      option.value = kind;
      option.textContent = t("goodsGallery.kindOption." + kind);
      kindSelect.appendChild(option);
    });
    bindControl("kind", kindSelect);
    var labelInput = document.createElement("input");
    labelInput.autocomplete = "off";
    bindControl("sourceLabel", labelInput);
    var sourceUrlInput = document.createElement("input");
    sourceUrlInput.type = "url";
    sourceUrlInput.autocomplete = "off";
    bindControl("sourceUrl", sourceUrlInput);
    var urlField = createGoodsGalleryField("goodsGallery.url", urlInput);
    urlField.classList.add("is-wide");
    fields.append(
      urlField,
      createGoodsGalleryField("goodsGallery.kind", kindSelect),
      createGoodsGalleryField("goodsGallery.altText", altInput),
      createGoodsGalleryField("goodsGallery.policyState", policySelect),
      createGoodsGalleryField("goodsGallery.sourceLabel", labelInput),
      createGoodsGalleryField("goodsGallery.sourceUrl", sourceUrlInput)
    );
    var messages = document.createElement("ul");
    messages.className = "hub-event-gallery-messages";
    messages.setAttribute("aria-live", "polite");

    var body = document.createElement("div");
    body.className = "hub-event-gallery-body";
    body.append(head, fields, messages);
    root.append(thumb, body);
    list.appendChild(root);
    var refs = { root: root, thumb: thumb, img: img, controls: controls, messages: messages, up: up, down: down };
    setGoodsGalleryThumb(refs, row.url);
    return refs;
  });
  refreshGoodsGalleryMessages();
}

function addGoodsGalleryRow() {
  if (goodsGalleryRows.length >= GOODS_GALLERY_MAX) return;
  var sourceInput = hubEventFields.sourceUrl;
  goodsGalleryRows.push(newGoodsGalleryRow({
    policyState: "official_runtime_url",
    kind: "md",
    altText: GOODS_GALLERY_ALT_PREFIXES.md + (goodsGalleryRows.filter(function (row) { return row.kind !== "bonus"; }).length + 1),
    sourceLabel: GOODS_GALLERY_DEFAULT_LABEL,
    sourceUrl: sourceInput ? sourceInput.value.trim() : ""
  }));
  goodsGalleryDirty = true;
  renderGoodsGallery();
}

function renderGoodsGalleryImportResult(errors, warnings, appliedCount) {
  var root = goodsGalleryNode("hub-event-goods-gallery-import-result");
  root.replaceChildren();
  function addBlock(className, heading, issues, kind) {
    var block = document.createElement("div");
    block.className = className;
    var title = document.createElement("strong");
    title.textContent = heading;
    block.appendChild(title);
    var list = document.createElement("ul");
    list.className = "hub-event-gallery-messages";
    issues.forEach(function (issue) {
      var item = document.createElement("li");
      item.className = kind === "err" ? "is-error" : "is-warning";
      var text = goodsGalleryIssueText(kind, issue);
      if (issue.index >= 0) text = t("goodsGallery.importRow", { row: issue.index + 1 }) + ": " + (issue.field ? issue.field + " - " : "") + text;
      item.textContent = text;
      list.appendChild(item);
    });
    block.appendChild(list);
    root.appendChild(block);
  }
  if (errors.length > 0) addBlock("is-error", t("goodsGallery.importErrors", { count: errors.length }), errors, "err");
  if (appliedCount > 0) {
    var applied = document.createElement("p");
    applied.className = "subtle";
    applied.textContent = t("goodsGallery.importApplied", { count: appliedCount });
    root.appendChild(applied);
  }
  if (warnings.length > 0) addBlock("is-warning", t("goodsGallery.importWarnings", { count: warnings.length }), warnings, "warn");
}

function importGoodsGallery(mode) {
  var textarea = goodsGalleryNode("hub-event-goods-gallery-import-text");
  var base = mode === "replace" ? [] : goodsGalleryRows;
  var result = parseGoodsGalleryImport(textarea.value, {
    sourceUrl: hubEventFields.sourceUrl ? hubEventFields.sourceUrl.value.trim() : "",
    sourceLabel: GOODS_GALLERY_DEFAULT_LABEL,
    startIndex: base.length,
    existingUrls: base.map(function (row) { return row.url; }),
    existingKinds: base.map(function (row) { return row.kind; })
  });
  if (result.errors.length > 0) {
    renderGoodsGalleryImportResult(result.errors, result.warnings, 0);
    return;
  }
  if (mode === "replace" && goodsGalleryRows.length > 0 && !window.confirm(t("goodsGallery.importReplaceConfirm", { existing: goodsGalleryRows.length, count: result.images.length }))) return;
  goodsGalleryRows = base.concat(result.images.map(newGoodsGalleryRow));
  goodsGalleryDirty = true;
  textarea.value = "";
  renderGoodsGallery();
  renderGoodsGalleryImportResult([], result.warnings, result.images.length);
}

/** Loads the editor from an admin event (absent goodsListImages means none stored). */
function bindGoodsGalleryForEvent(event) {
  var images = event && Array.isArray(event.goodsListImages) ? event.goodsListImages : [];
  goodsGalleryRows = images.map(newGoodsGalleryRow);
  goodsGalleryDirty = false;
  goodsGalleryGlobalErrors = [];
  goodsGalleryNode("hub-event-goods-gallery-import-text").value = "";
  goodsGalleryNode("hub-event-goods-gallery-import-result").replaceChildren();
  renderGoodsGallery();
}

/** Adds goodsListImages to an event write body; untouched galleries are omitted so older values are never cleared by accident. */
function collectGoodsGalleryInput(input) {
  if (goodsGalleryDirty) input.goodsListImages = buildGoodsGalleryPayload(goodsGalleryRows);
}

/** Routes server validation errors for goodsListImages.N.field to the matching row; resets earlier server errors. */
function showGoodsGalleryServerErrors(errors) {
  goodsGalleryGlobalErrors = [];
  goodsGalleryRows.forEach(function (row) { row.serverErrors = []; });
  (errors || []).forEach(function (error) {
    var parsed = parseGoodsGalleryServerErrorField(error.field);
    if (!parsed) return;
    var text = [parsed.field || error.field, error.reason, error.message].filter(Boolean).join(" - ");
    if (parsed.row >= 0 && goodsGalleryRows[parsed.row]) {
      goodsGalleryRows[parsed.row].serverErrors.push({ field: parsed.field, text: text });
    } else {
      goodsGalleryGlobalErrors.push(text);
    }
  });
  refreshGoodsGalleryMessages();
}

goodsGalleryNode("hub-event-goods-gallery-add").addEventListener("click", addGoodsGalleryRow);
goodsGalleryNode("hub-event-goods-gallery-import-append").addEventListener("click", function () { importGoodsGallery("append"); });
goodsGalleryNode("hub-event-goods-gallery-import-replace").addEventListener("click", function () { importGoodsGallery("replace"); });
renderGoodsGallery();
`;

export const goodsGalleryStyle = String.raw`
.hub-event-goods-gallery { display: grid; gap: 10px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--line); }
.hub-event-goods-gallery h4 { margin: 0; }
.hub-event-gallery-list { display: grid; gap: 8px; }
.hub-event-gallery-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--surface-soft); }
.hub-event-gallery-row[aria-invalid="true"] { border-color: var(--danger); }
.hub-event-gallery-row [aria-invalid="true"] { outline: 2px solid var(--danger); outline-offset: 1px; }
.hub-event-gallery-thumb { position: relative; width: 96px; height: 128px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; display: grid; place-items: center; }
.hub-event-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
.hub-event-gallery-thumb-note { display: none; padding: 4px; font-size: 11px; text-align: center; color: var(--admin-muted); }
.hub-event-gallery-thumb.is-broken img { display: none; }
.hub-event-gallery-thumb.is-broken .hub-event-gallery-thumb-note { display: block; }
.hub-event-gallery-body { display: grid; gap: 8px; min-width: 0; }
.hub-event-gallery-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hub-event-gallery-actions { display: flex; gap: 6px; }
.hub-event-gallery-actions button { min-width: 38px; min-height: 38px; }
.hub-event-gallery-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.hub-event-gallery-field { display: grid; gap: 3px; font-size: 12px; color: var(--admin-muted); min-width: 0; }
.hub-event-gallery-field.is-wide { grid-column: 1 / -1; }
.hub-event-gallery-field input, .hub-event-gallery-field select { width: 100%; min-width: 0; }
.hub-event-gallery-messages { margin: 0; padding-left: 18px; font-size: 12px; }
.hub-event-gallery-messages:empty { display: none; }
.hub-event-gallery-messages .is-error, .hub-event-gallery-import .is-error { color: var(--danger); }
.hub-event-gallery-messages .is-warning, .hub-event-gallery-import .is-warning { color: var(--admin-warning, #b7791f); }
.hub-event-gallery-import textarea { width: 100%; min-height: 110px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
@media (max-width: 640px) {
  .hub-event-gallery-row { grid-template-columns: 1fr; }
  .hub-event-gallery-thumb { width: 100%; height: 160px; }
  .hub-event-gallery-fields { grid-template-columns: 1fr; }
}
`;

/** Source embedded into the console's inline script (parser + DOM wiring). */
export function renderAdminGoodsGalleryScript(): string {
  return `${goodsGalleryParserSource}\n${goodsGalleryUiSource}`;
}

/** Stylesheet rules embedded into the console's <style> block. */
export function renderAdminGoodsGalleryStyle(): string {
  return goodsGalleryStyle;
}

export interface GoodsGalleryParseResult {
  format: "json" | "lines" | "";
  images: Array<Record<string, string> | null>;
  errors: Array<{ index: number; field: string; code: string; detail: string }>;
  warnings: Array<{ index: number; field: string; code: string; detail: string }>;
}

export interface GoodsGalleryHelpers {
  parseGoodsGalleryImport: (text: string, context?: Record<string, unknown>) => GoodsGalleryParseResult;
  goodsGalleryCheckImages: (
    images: Array<Record<string, string> | null>,
    existingUrls?: string[]
  ) => Pick<GoodsGalleryParseResult, "errors" | "warnings">;
  buildGoodsGalleryPayload: (rows: Array<Record<string, string>>) => Array<Record<string, string>>;
  parseGoodsGalleryServerErrorField: (field: string) => { row: number; field: string } | null;
  isGoodsGalleryAllowedHost: (hostname: string) => boolean;
  GOODS_GALLERY_MAX: number;
}

/** Test helper: evaluates the embedded parser source exactly as the browser would. */
export function loadGoodsGalleryHelpers(): GoodsGalleryHelpers {
  return new Function(
    `${goodsGalleryParserSource}\nreturn { parseGoodsGalleryImport, goodsGalleryCheckImages, buildGoodsGalleryPayload, parseGoodsGalleryServerErrorField, isGoodsGalleryAllowedHost, GOODS_GALLERY_MAX };`
  )() as GoodsGalleryHelpers;
}
