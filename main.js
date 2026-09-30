"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => KnowledgeSpacePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/modals.ts
var import_obsidian = require("obsidian");

// src/settings.ts
var DEFAULT_SETTINGS = Object.freeze({
  fontSize: 20,
  fontFamily: "sans",
  inkStrength: 100,
  contentWidth: 760,
  pageGutter: 24,
  tone: "dark",
  background: "aurora",
  strength: 70,
  blur: 20,
  opacity: 94,
  imagePath: "",
  enabled: true
});
function isSafeImagePath(path) {
  if (!path || path !== path.trim() || path.startsWith("/")) return false;
  if (path.includes("..") || /[\\:"'`%?#<>\u0000-\u001f\u007f]/.test(path)) return false;
  if (path.split("/").some((segment) => !segment || segment === ".")) return false;
  return /\.(?:png|jpe?g|webp|avif)$/i.test(path);
}
function boundedInteger(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)));
}
function choice(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}
function normalizeSettings(raw) {
  const saved = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const candidatePath = typeof saved.imagePath === "string" ? saved.imagePath.trim() : "";
  const imagePath = isSafeImagePath(candidatePath) ? candidatePath : "";
  const background = choice(saved.background, ["aurora", "dusk", "plain", "image"], DEFAULT_SETTINGS.background);
  return {
    fontSize: boundedInteger(saved.fontSize, DEFAULT_SETTINGS.fontSize, 12, 32),
    fontFamily: choice(saved.fontFamily, ["sans", "serif", "jhenghei"], DEFAULT_SETTINGS.fontFamily),
    inkStrength: boundedInteger(saved.inkStrength, DEFAULT_SETTINGS.inkStrength, 35, 100),
    contentWidth: boundedInteger(saved.contentWidth, DEFAULT_SETTINGS.contentWidth, 360, 1600),
    pageGutter: boundedInteger(saved.pageGutter, DEFAULT_SETTINGS.pageGutter, 0, 300),
    tone: choice(saved.tone, ["system", "dark", "light"], DEFAULT_SETTINGS.tone),
    background: background === "image" && !imagePath ? "aurora" : background,
    strength: boundedInteger(saved.strength, DEFAULT_SETTINGS.strength, 0, 100),
    blur: boundedInteger(saved.blur, DEFAULT_SETTINGS.blur, 0, 40),
    opacity: boundedInteger(saved.opacity, DEFAULT_SETTINGS.opacity, 0, 100),
    imagePath,
    enabled: typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_SETTINGS.enabled
  };
}

// src/modals.ts
var AppearanceModal = class extends import_obsidian.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  onOpen() {
    this.modalEl.addClass("kn-appearance-modal");
    this.draw();
  }
  draw() {
    const { contentEl, plugin } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u7B46\u8A18\u5916\u89C0" });
    contentEl.createEl("p", { cls: "kn-modal-help", text: "\u6240\u6709\u7B46\u8A18\u7684\u95B1\u8B80\u6A21\u5F0F\u8207\u5373\u6642\u9810\u89BD\u90FD\u6703\u5957\u7528\uFF0C\u8A2D\u5B9A\u6703\u81EA\u52D5\u5132\u5B58\u3002" });
    new import_obsidian.Setting(contentEl).setName("\u5957\u7528\u5230\u6240\u6709\u7B46\u8A18").addToggle((toggle) => toggle.setValue(plugin.settings.enabled).onChange((value) => {
      void plugin.updateSettings({ enabled: value });
    }));
    const cards = contentEl.createDiv("kn-background-options");
    for (const [preset, label] of [["aurora", "\u6975\u5149"], ["dusk", "\u66AE\u8272"], ["plain", "\u7D14\u8272"]]) {
      const button = cards.createEl("button", { cls: "kn-background-card", attr: { "aria-pressed": String(plugin.settings.background === preset) } });
      button.dataset.selected = String(plugin.settings.background === preset);
      button.createSpan({ cls: "kn-swatch", attr: { "data-preset": preset } });
      button.createSpan({ text: label });
      button.onclick = () => {
        void plugin.updateSettings({ background: preset });
        this.draw();
      };
    }
    new import_obsidian.Setting(contentEl).setName("\u672C\u6A5F\u5716\u7247\u80CC\u666F").setDesc(plugin.settings.imagePath ? "\u5DF2\u5132\u5B58\u4E00\u4EFD\u5716\u7247\u526F\u672C\uFF0C\u53EF\u91CD\u65B0\u4F7F\u7528\u3002" : "\u5716\u7247\u5132\u5B58\u5728\u5916\u639B\u8CC7\u6599\u593E\uFF0C\u672C\u5916\u639B\u4E0D\u6703\u4E0A\u50B3\uFF1BVault \u540C\u6B65\u5DE5\u5177\u53EF\u80FD\u540C\u6B65\u6B64\u8CC7\u6599\u593E\u3002").addButton((button) => button.setButtonText("\u9078\u64C7\u5716\u7247").onClick(() => {
      const input = contentEl.createEl("input", { type: "file", attr: { accept: "image/png,image/jpeg,image/webp,image/avif", hidden: "" } });
      input.onchange = async () => {
        var _a;
        const file = (_a = input.files) == null ? void 0 : _a[0];
        if (!file) {
          input.remove();
          return;
        }
        button.setDisabled(true);
        try {
          await plugin.importBackground(file);
          if (this.modalEl.isConnected) this.draw();
        } catch (error) {
          new import_obsidian.Notice(`\u7121\u6CD5\u8A2D\u5B9A\u80CC\u666F\uFF1A${error instanceof Error ? error.message : String(error)}`);
        } finally {
          input.remove();
          button.setDisabled(false);
        }
      };
      input.click();
    }));
    if (plugin.settings.imagePath) {
      new import_obsidian.Setting(contentEl).setName("\u5DF2\u5132\u5B58\u7684\u5716\u7247").addButton((button) => button.setButtonText("\u4F7F\u7528\u5716\u7247").onClick(() => {
        void plugin.updateSettings({ background: "image" });
        this.draw();
      })).addButton((button) => button.setButtonText("\u6E05\u9664\u9078\u64C7").onClick(() => {
        void plugin.updateSettings({ imagePath: "", background: "aurora" });
        this.draw();
      }));
    }
    new import_obsidian.Setting(contentEl).setName("\u8272\u7CFB").addDropdown((drop) => drop.addOptions({ system: "\u8DDF\u96A8 Obsidian", dark: "\u6DF1\u8272", light: "\u6DFA\u8272" }).setValue(plugin.settings.tone).onChange((value) => {
      void plugin.updateSettings({ tone: value });
    }));
    new import_obsidian.Setting(contentEl).setName("\u5B57\u9AD4").setDesc("\u5FAE\u8EDF\u6B63\u9ED1\u9AD4\u4F7F\u7528\u88DD\u7F6E\u4E0A\u53EF\u7528\u7684\u5B57\u578B\uFF1B\u82E5\u672A\u5B89\u88DD\uFF0C\u6703\u4F7F\u7528\u7CFB\u7D71\u9ED1\u9AD4\u3002\u5916\u639B\u4E0D\u9644\u5E36\u5546\u7528\u5B57\u578B\u6A94\u6848\u3002").addDropdown((drop) => drop.addOptions({ sans: "\u6E05\u6670\u9ED1\u9AD4", serif: "\u66F8\u9801\u5B8B\u9AD4", jhenghei: "\u5FAE\u8EDF\u6B63\u9ED1\u9AD4" }).setValue(plugin.settings.fontFamily).onChange((value) => {
      void plugin.updateSettings({ fontFamily: value });
    }));
    for (const [key, label, min, max, suffix] of [
      ["fontSize", "\u6B63\u6587\u5B57\u7D1A", 12, 32, "px"],
      ["inkStrength", "\u6587\u5B57\u660E\u6697\uFF08\u8D8A\u4F4E\u8D8A\u67D4\u548C\uFF09", 35, 100, "%"],
      ["contentWidth", "\u6B63\u6587\u5BEC\u5EA6\u4E0A\u9650", 360, 1600, "px"],
      ["pageGutter", "\u5361\u7247\u5916\u5074\u5DE6\u53F3\u7559\u767D", 0, 300, "px"],
      ["strength", "\u80CC\u666F\u6FC3\u5EA6", 0, 100, "%"],
      ["blur", "\u80CC\u666F\u67D4\u7126", 0, 40, "px"],
      ["opacity", "\u95B1\u8B80\u9762\u677F\u4E0D\u900F\u660E\u5EA6", 0, 100, "%"]
    ]) {
      const setting = new import_obsidian.Setting(contentEl).setName(`${label} \xB7 ${plugin.settings[key]}${suffix}`);
      if (key === "opacity") setting.setDesc("0% \u5B8C\u5168\u900F\u660E\uFF0C100% \u5B8C\u5168\u4E0D\u900F\u660E\uFF1B\u4E0D\u6539\u8B8A\u6587\u5B57\u900F\u660E\u5EA6\u3002");
      if (key === "contentWidth") setting.setDesc("\u9650\u5236\u6B63\u6587\u7684\u884C\u5BEC\uFF1B\u5361\u7247\u5916\u5074\u9732\u51FA\u7684\u80CC\u666F\u7531\u4E0B\u4E00\u9805\u63A7\u5236\u3002");
      if (key === "pageGutter") setting.setDesc("0px \u92EA\u6EFF\u95B1\u8B80\u5340\uFF1B\u6578\u503C\u8D8A\u5927\uFF0C\u5DE6\u53F3\u9732\u51FA\u7684\u80CC\u666F\u8D8A\u591A\uFF0C\u6BCF\u5074\u6700\u591A 300px\u3002\u7A84\u9801\u6703\u81EA\u52D5\u7E2E\u6E1B\uFF0C\u907F\u514D\u6B63\u6587\u88AB\u64E0\u51FA\u3002");
      setting.addSlider((slider) => {
        var _a;
        slider.setLimits(min, max, 1).setValue(plugin.settings[key]).setDynamicTooltip();
        if (key === "pageGutter") (_a = slider.setInstant) == null ? void 0 : _a.call(slider, true);
        slider.onChange((value) => {
          setting.setName(`${label} \xB7 ${value}${suffix}`);
          void plugin.updateSettings({ [key]: value });
        });
      });
    }
    new import_obsidian.Setting(contentEl).setName("\u672C\u7BC7\u76EE\u9304").setDesc("\u6309\u7B46\u8A18\u5DE6\u4E0A\u89D2\u300C\u524D\u9032\u7BAD\u982D\u300D\u65C1\u7684\u76EE\u9304\u5716\u793A\u5C55\u958B\u6216\u6536\u5408\u3002\u5BEC\u9801\u76EE\u9304\u5728\u5DE6\u5074\uFF0C\u7A84\u9801\u5F9E\u5DE6\u4E0A\u89D2\u5C55\u958B\u3002").addButton((button) => button.setButtonText("\u986F\u793A\u76EE\u524D\u76EE\u9304").onClick(() => {
      this.close();
      plugin.revealOutline();
    }));
    const actions = contentEl.createDiv("kn-modal-actions");
    actions.createEl("button", { text: "\u91CD\u8A2D\u5916\u89C0" }).onclick = () => {
      void plugin.updateSettings({ ...DEFAULT_SETTINGS, enabled: plugin.settings.enabled, imagePath: plugin.settings.imagePath });
      this.draw();
    };
    actions.createEl("button", { text: "\u5B8C\u6210", cls: "mod-cta" }).onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/outline.ts
var import_obsidian2 = require("obsidian");

// src/outline-model.ts
function headingLabel(value) {
  return value.replace(/!?\[\[([^\]]+)\]\]/g, (_match, link) => {
    const parts = link.split("|");
    return parts[parts.length - 1];
  }).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").trim();
}
function outlineEntries(headings, basename) {
  const sections = headings.filter((heading, i) => !(i === 0 && headingLabel(heading.heading) === basename));
  const baseLevel = Math.min(...sections.map((heading) => heading.level));
  return sections.map((heading) => ({ label: headingLabel(heading.heading), line: heading.position.start.line, depth: heading.level - baseLevel }));
}
function currentSection(entries, line) {
  let active = entries.length ? 0 : -1;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].line > line + 0.25) break;
    active = i;
  }
  return active;
}

// src/outline.ts
var NativeOutline = class extends import_obsidian2.Component {
  constructor(view) {
    var _a;
    super();
    this.view = view;
    this.wideViewport = null;
    this.isOpen = false;
    this.entries = [];
    this.buttons = [];
    this.signature = "";
    this.activeIndex = -1;
    this.frame = 0;
    this.navigationFrame = 0;
    this.navigationToken = 0;
    this.navigationPending = false;
    this.navigationObserver = null;
    this.navigationTimeout = 0;
    this.selectedLanding = null;
    this.host = view.contentEl;
    this.createdDocument = this.host.ownerDocument;
    this.win = this.host.ownerDocument.defaultView;
    this.host.addClass("kn-with-outline");
    this.panel = this.host.createEl("aside", { cls: "kn-native-outline", attr: { "aria-label": "\u672C\u7BC7\u76EE\u9304" } });
    const header = this.panel.createEl("header");
    header.createEl("small", { text: "\u672C\u7BC7\u76EE\u9304" });
    this.title = header.createDiv("kn-outline-title");
    this.items = this.panel.createEl("nav", { cls: "kn-outline-items", attr: { "aria-label": "\u7B46\u8A18\u7AE0\u7BC0" } });
    this.toggle = this.view.addAction("list-tree", "\u672C\u7BC7\u76EE\u9304", () => {
    });
    this.toggle.addClass("kn-outline-toggle");
    this.toggle.setAttribute("aria-expanded", "false");
    this.toggle.setAttribute("aria-label", "\u672C\u7BC7\u76EE\u9304");
    this.toggle.setAttribute("role", "button");
    this.toggle.setAttribute("tabindex", "0");
    if (!this.createdDocument.body.classList.contains("is-phone")) {
      (_a = this.view.containerEl.querySelector(".view-header-nav-buttons")) == null ? void 0 : _a.appendChild(this.toggle);
    }
  }
  onload() {
    this.registerDomEvent(this.toggle, "click", () => this.setOpen(!this.isOpen));
    this.registerDomEvent(this.toggle, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.setOpen(!this.isOpen);
      }
    });
    this.registerDomEvent(this.items, "click", (event) => {
      const button = event.target.closest("button[data-index]");
      if (!button) return;
      const index = Number(button.dataset.index);
      const entry = this.entries[index];
      if (!entry) return;
      if (!this.wideViewport) this.setOpen(false);
      this.navigate(index, entry);
    });
    this.registerDomEvent(this.host, "scroll", (event) => {
      if (this.panel.contains(event.target)) return;
      this.scheduleActive();
    }, { capture: true, passive: true });
    this.registerDomEvent(this.host, "wheel", (event) => {
      if (!this.panel.contains(event.target)) this.cancelNavigation();
    }, { passive: true });
    this.registerDomEvent(this.host, "touchstart", (event) => {
      if (!this.panel.contains(event.target)) this.cancelNavigation();
    }, { passive: true });
    this.registerDomEvent(this.host.ownerDocument, "keydown", (event) => {
      if (event.key === "Escape" && this.host.hasClass("kn-outline-open")) {
        this.setOpen(false);
        this.toggle.focus();
      }
    });
    this.registerDomEvent(this.host.ownerDocument, "pointerdown", (event) => {
      if (!this.wideViewport && !this.panel.contains(event.target) && !this.toggle.contains(event.target)) this.setOpen(false);
    });
    const resize = new ResizeObserver(() => {
      const wide = this.host.getBoundingClientRect().width >= 1e3;
      if (wide !== this.wideViewport) {
        this.wideViewport = wide;
        this.setOpen(wide);
      }
      this.scheduleActive();
    });
    resize.observe(this.host);
    this.register(() => {
      resize.disconnect();
      if (this.frame) this.win.cancelAnimationFrame(this.frame);
      this.cancelNavigation();
      this.panel.remove();
      this.toggle.remove();
      this.host.removeClass("kn-with-outline", "kn-outline-wide", "kn-outline-open");
    });
    this.refresh();
  }
  refresh() {
    var _a, _b, _c, _d;
    const file = this.view.file;
    const entries = file ? outlineEntries((_b = (_a = this.view.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.headings) != null ? _b : [], file.basename) : [];
    const signature = JSON.stringify([file == null ? void 0 : file.path, entries]);
    if (signature !== this.signature) {
      this.cancelNavigation();
      this.signature = signature;
      this.entries = entries;
      this.activeIndex = -1;
      this.title.setText((_c = file == null ? void 0 : file.basename) != null ? _c : "\u7B46\u8A18");
      this.title.title = (_d = file == null ? void 0 : file.basename) != null ? _d : "";
      this.items.empty();
      this.buttons = entries.map((entry, index) => {
        const button = this.items.createEl("button", { cls: "kn-outline-link", attr: { "data-index": String(index), title: entry.label } });
        button.style.setProperty("--kn-outline-depth", String(Math.min(entry.depth, 4)));
        button.createSpan({ cls: "kn-outline-number", text: String(index + 1).padStart(2, "0") });
        button.createSpan({ cls: "kn-outline-label", text: entry.label });
        return button;
      });
      if (!entries.length) this.items.createEl("p", { cls: "kn-outline-empty", text: "\u9019\u7BC7\u7B46\u8A18\u9084\u6C92\u6709\u7AE0\u7BC0\u6A19\u984C\u3002" });
    }
    this.scheduleActive();
  }
  get isMounted() {
    return this.host === this.view.contentEl && this.panel.parentElement === this.host && this.toggle.isConnected;
  }
  reveal() {
    var _a;
    this.setOpen(true);
    ((_a = this.buttons[Math.max(0, this.activeIndex)]) != null ? _a : this.toggle).focus();
  }
  setOpen(open) {
    this.isOpen = open;
    const docked = !!this.wideViewport && open;
    if (this.host.hasClass("kn-outline-wide") !== docked) this.host.toggleClass("kn-outline-wide", docked);
    if (this.host.hasClass("kn-outline-open") !== open) this.host.toggleClass("kn-outline-open", open);
    this.toggle.setAttribute("aria-expanded", String(open));
    this.toggle.setAttribute("aria-label", open ? "\u6536\u5408\u672C\u7BC7\u76EE\u9304" : "\u958B\u555F\u672C\u7BC7\u76EE\u9304");
  }
  scheduleActive() {
    if (this.frame) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      if (this.navigationPending) return;
      const line = this.view.currentMode.getScroll();
      if (typeof line !== "number" || !Number.isFinite(line)) return;
      if (this.selectedLanding && Math.abs(line - this.selectedLanding.line) < 0.01) {
        this.setActive(this.selectedLanding.index);
        return;
      }
      this.selectedLanding = null;
      this.setActive(currentSection(this.entries, line));
    });
  }
  cancelNavigation() {
    var _a;
    this.navigationToken++;
    if (this.navigationFrame) this.win.cancelAnimationFrame(this.navigationFrame);
    this.navigationFrame = 0;
    this.navigationPending = false;
    (_a = this.navigationObserver) == null ? void 0 : _a.disconnect();
    this.navigationObserver = null;
    if (this.navigationTimeout) this.win.clearTimeout(this.navigationTimeout);
    this.navigationTimeout = 0;
    if (this.host.hasClass("kn-outline-jump")) {
      this.host.querySelectorAll(":scope > .markdown-reading-view > .markdown-preview-view .is-flashing").forEach((el) => el.classList.remove("is-flashing"));
      this.host.removeClass("kn-outline-jump");
    }
    this.selectedLanding = null;
  }
  navigate(index, entry) {
    this.cancelNavigation();
    const token = this.navigationToken;
    const mode = this.view.getMode();
    const lastLine = mode === "source" ? this.view.editor.lastLine() : this.view.getViewData().split("\n").length - 1;
    const line = Math.max(0, Math.min(entry.line, lastLine));
    this.navigationPending = true;
    this.setActive(index);
    const finish = () => {
      this.navigationFrame = this.win.requestAnimationFrame(() => {
        if (token !== this.navigationToken) return;
        this.navigationFrame = 0;
        if (this.view.getMode() !== mode) {
          this.cancelNavigation();
          this.scheduleActive();
          return;
        }
        this.navigationPending = false;
        this.selectedLanding = { index, line: this.view.currentMode.getScroll() };
        this.setActive(index);
      });
    };
    const scroller = mode === "preview" ? this.host.querySelector(":scope > .markdown-reading-view > .markdown-preview-view") : null;
    if (!scroller) {
      this.view.leaf.setEphemeralState({ scroll: line });
      finish();
      return;
    }
    scroller.querySelectorAll(".is-flashing").forEach((el) => el.classList.remove("is-flashing"));
    this.host.addClass("kn-outline-jump");
    const align = () => {
      var _a;
      this.navigationFrame = 0;
      if (token !== this.navigationToken) return;
      if (this.view.getMode() !== mode) {
        this.cancelNavigation();
        this.scheduleActive();
        return;
      }
      const section = scroller.querySelector(".is-flashing");
      if (!section) return;
      const candidates = section.matches("h1,h2,h3,h4,h5,h6") ? [section] : [...section.querySelectorAll("h1,h2,h3,h4,h5,h6")];
      const heading = candidates.find((el) => {
        var _a2;
        return !el.closest(".markdown-embed, .internal-embed") && headingLabel((_a2 = el.textContent) != null ? _a2 : "") === entry.label;
      });
      if (heading) {
        const offset = heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24;
        scroller.scrollTop = Math.max(0, scroller.scrollTop + offset);
      }
      section.classList.remove("is-flashing");
      (_a = this.navigationObserver) == null ? void 0 : _a.disconnect();
      this.navigationObserver = null;
      this.win.clearTimeout(this.navigationTimeout);
      this.navigationTimeout = 0;
      this.host.removeClass("kn-outline-jump");
      finish();
    };
    const queueAlign = () => {
      if (token === this.navigationToken && !this.navigationFrame) this.navigationFrame = this.win.requestAnimationFrame(align);
    };
    this.navigationObserver = new MutationObserver(queueAlign);
    this.navigationObserver.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    this.navigationTimeout = this.win.setTimeout(() => {
      if (token !== this.navigationToken) return;
      this.cancelNavigation();
      this.scheduleActive();
    }, 2e3);
    this.view.leaf.setEphemeralState({ line, focus: false });
    queueAlign();
  }
  setActive(index) {
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    this.buttons.forEach((button, i) => {
      button.toggleClass("is-active", index === i);
      if (index === i) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    });
  }
};

// src/local-fonts.ts
var import_obsidian3 = require("obsidian");
var LOCAL_JHENGHEI_FAMILY = "Knowledge Space JhengHei";
var LocalFonts = class {
  constructor(app, manifestDir) {
    this.app = app;
    this.documents = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.directory = (0, import_obsidian3.normalizePath)(`${manifestDir}/assets/fonts`);
  }
  /** Repeated calls share one attempt per document, including absent assets. */
  ensure(doc) {
    if (this.disposed) return Promise.resolve();
    const existing = this.documents.get(doc);
    if (existing) return existing.ready;
    const entry = { faces: [], ready: Promise.resolve() };
    this.documents.set(doc, entry);
    entry.ready = this.loadDocument(doc, entry).catch((error) => {
      if (this.isCurrent(doc, entry)) console.warn("Knowledge Space local font loading failed", error);
    });
    return entry.ready;
  }
  /** A document can be re-ensured after removal; dispose() permanently stops this manager. */
  dispose(doc) {
    if (!doc) {
      this.disposed = true;
      for (const existing of [...this.documents.keys()]) this.dispose(existing);
      return;
    }
    const entry = this.documents.get(doc);
    if (!entry) return;
    this.documents.delete(doc);
    for (const face of entry.faces) {
      try {
        doc.fonts.delete(face);
      } catch (error) {
        console.warn("Knowledge Space local font cleanup failed", error);
      }
    }
    entry.faces.length = 0;
  }
  isCurrent(doc, entry) {
    return !this.disposed && this.documents.get(doc) === entry && !!doc.defaultView && !doc.defaultView.closed;
  }
  async loadDocument(doc, entry) {
    const owner = doc.defaultView;
    const Face = owner == null ? void 0 : owner.FontFace;
    if (!Face || !doc.fonts || !this.isCurrent(doc, entry)) return;
    const faces = await Promise.all([
      this.loadFace(doc, entry, Face, "MSJH.ttf", "400"),
      this.loadFace(doc, entry, Face, "MSJHBD.ttf", "700")
    ]);
    if (!this.isCurrent(doc, entry)) return;
    for (const face of faces) {
      if (!face) continue;
      try {
        doc.fonts.add(face);
        entry.faces.push(face);
      } catch (error) {
        console.warn("Knowledge Space could not register a local font", error);
      }
    }
  }
  async loadFace(doc, entry, Face, filename, weight) {
    try {
      const path = (0, import_obsidian3.normalizePath)(`${this.directory}/${filename}`);
      if (!await this.app.vault.adapter.exists(path) || !this.isCurrent(doc, entry)) return null;
      const resource = this.app.vault.adapter.getResourcePath(path);
      const face = new Face(LOCAL_JHENGHEI_FAMILY, `url(${JSON.stringify(resource)}) format("truetype")`, {
        weight,
        style: "normal",
        display: "swap"
      });
      await face.load();
      return this.isCurrent(doc, entry) ? face : null;
    } catch (error) {
      if (this.isCurrent(doc, entry)) console.warn(`Knowledge Space could not load ${filename}`, error);
      return null;
    }
  }
};

// src/main.ts
var APPEARANCE_PROPERTIES = ["--kn-font-size", "--kn-font", "--kn-background-strength", "--kn-background-blur", "--kn-panel-opacity", "--kn-background-image", "--kn-ink-strength", "--kn-content-width", "--kn-page-gutter"];
var LEGACY_VIEW = "knowledge-space-reader";
var KnowledgeSpacePlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.documents = /* @__PURE__ */ new Set();
    this.appliedSettings = /* @__PURE__ */ new WeakMap();
    this.outlines = /* @__PURE__ */ new Map();
    this.unloaded = false;
    this.localFonts = null;
    this.saveQueue = Promise.resolve();
  }
  async onload() {
    var _a;
    this.settings = normalizeSettings(await this.loadData());
    this.localFonts = new LocalFonts(this.app, (_a = this.manifest.dir) != null ? _a : `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    this.addRibbonIcon("palette", "\u7B46\u8A18\u5916\u89C0\u8207\u80CC\u666F", () => this.openAppearance());
    this.addCommand({ id: "reading-appearance", name: "\u7B46\u8A18\u5916\u89C0\u8207\u80CC\u666F", callback: () => this.openAppearance() });
    this.addCommand({ id: "show-note-outline", name: "\u986F\u793A\u672C\u7BC7\u76EE\u9304", callback: () => this.revealOutline() });
    this.addSettingTab(new SpaceSettingTab(this));
    this.registerEvent(this.app.workspace.on("window-open", (_win, window) => {
      this.documents.add(window.document);
      this.applyDocument(window.document);
    }));
    this.registerEvent(this.app.workspace.on("window-close", (_win, window) => {
      this.clearDocument(window.document);
      this.documents.delete(window.document);
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      this.applyAppearance();
      this.syncOutlines();
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncOutlines()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncOutlines()));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      var _a2;
      for (const [view, outline] of this.outlines) if (((_a2 = view.file) == null ? void 0 : _a2.path) === file.path) outline.refresh();
    }));
    this.register(() => {
      var _a2;
      this.unloaded = true;
      for (const doc of this.documents) this.clearDocument(doc);
      this.documents.clear();
      (_a2 = this.localFonts) == null ? void 0 : _a2.dispose();
      for (const outline of this.outlines.values()) this.removeChild(outline);
      this.outlines.clear();
    });
    this.applyAppearance();
    this.app.workspace.onLayoutReady(() => {
      if (this.unloaded) return;
      this.applyAppearance();
      void this.migrateLegacyViews();
      this.syncOutlines();
    });
  }
  /** A previous custom reader becomes a regular native Markdown leaf. */
  async migrateLegacyViews() {
    var _a;
    for (const leaf of this.app.workspace.getLeavesOfType(LEGACY_VIEW)) {
      if (this.unloaded) return;
      const path = (_a = leaf.getViewState().state) == null ? void 0 : _a.file;
      const file = typeof path === "string" ? this.app.vault.getAbstractFileByPath(path) : null;
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") continue;
      try {
        await leaf.setViewState({ type: "markdown", state: { file: file.path, mode: "preview" } });
      } catch (error) {
        console.error("Knowledge Space native view migration failed", error);
      }
    }
  }
  applyAppearance() {
    if (this.unloaded) return;
    this.documents.add(this.app.workspace.containerEl.ownerDocument);
    this.app.workspace.iterateAllLeaves((leaf) => this.documents.add(leaf.view.containerEl.ownerDocument));
    for (const doc of this.documents) this.applyDocument(doc);
  }
  syncOutlines() {
    if (this.unloaded) return;
    const present = /* @__PURE__ */ new Set();
    if (this.settings.enabled) this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof import_obsidian4.MarkdownView)) return;
      const view = leaf.view;
      present.add(view);
      let outline = this.outlines.get(view);
      if (outline && (outline.createdDocument !== view.contentEl.ownerDocument || !outline.isMounted)) {
        this.removeChild(outline);
        this.outlines.delete(view);
        outline = void 0;
      }
      if (!outline) {
        outline = new NativeOutline(view);
        this.outlines.set(view, outline);
        this.addChild(outline);
      } else outline.refresh();
    });
    for (const [view, outline] of this.outlines) {
      if (!present.has(view)) {
        this.removeChild(outline);
        this.outlines.delete(view);
      }
    }
  }
  applyDocument(doc) {
    var _a, _b;
    const body = doc.body;
    if (!body) return;
    const signature = JSON.stringify(this.settings);
    if (this.appliedSettings.get(doc) === signature) return;
    if (!this.settings.enabled) {
      this.clearDocument(doc);
      this.appliedSettings.set(doc, signature);
      return;
    }
    const s = this.settings;
    body.classList.add("kn-native-enabled");
    body.dataset.knTone = s.tone;
    body.dataset.knBackground = s.background;
    body.style.setProperty("--kn-font-size", `${s.fontSize}px`);
    body.style.setProperty("--kn-font", s.fontFamily === "serif" ? '"Iowan Old Style", "Songti TC", "Noto Serif TC", serif' : s.fontFamily === "jhenghei" ? '"Knowledge Space JhengHei", "Microsoft JhengHei", "Microsoft JhengHei UI", "\u5FAE\u8EDF\u6B63\u9ED1\u9AD4", "PingFang TC", sans-serif' : '"Helvetica Neue", "PingFang TC", "Noto Sans TC", sans-serif');
    body.style.setProperty("--kn-ink-strength", `${s.inkStrength}%`);
    body.style.setProperty("--kn-content-width", `${s.contentWidth}px`);
    body.style.setProperty("--kn-page-gutter", `${s.pageGutter}px`);
    body.style.setProperty("--kn-background-strength", String(s.strength / 100));
    body.style.setProperty("--kn-background-blur", `${s.blur}px`);
    body.style.setProperty("--kn-panel-opacity", String(s.opacity / 100));
    const resource = s.imagePath ? this.app.vault.adapter.getResourcePath(s.imagePath) : "";
    body.style.setProperty("--kn-background-image", resource ? `url(${JSON.stringify(resource)})` : "none");
    if (s.fontFamily === "jhenghei") void ((_a = this.localFonts) == null ? void 0 : _a.ensure(doc));
    else (_b = this.localFonts) == null ? void 0 : _b.dispose(doc);
    this.appliedSettings.set(doc, signature);
  }
  clearDocument(doc) {
    var _a;
    this.appliedSettings.delete(doc);
    (_a = this.localFonts) == null ? void 0 : _a.dispose(doc);
    const body = doc.body;
    if (!body) return;
    body.classList.remove("kn-native-enabled");
    delete body.dataset.knTone;
    delete body.dataset.knBackground;
    for (const property of APPEARANCE_PROPERTIES) body.style.removeProperty(property);
  }
  revealOutline() {
    var _a;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (!view) {
      new import_obsidian4.Notice("\u8ACB\u5148\u958B\u555F\u4E00\u7BC7\u7B46\u8A18\u3002");
      return;
    }
    if (!this.settings.enabled) {
      new import_obsidian4.Notice("\u8ACB\u5148\u958B\u555F\u300C\u5957\u7528\u5230\u6240\u6709\u7B46\u8A18\u300D\u3002");
      return;
    }
    this.syncOutlines();
    (_a = this.outlines.get(view)) == null ? void 0 : _a.reveal();
  }
  openAppearance() {
    new AppearanceModal(this).open();
  }
  updateSettings(patch) {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    this.applyAppearance();
    this.syncOutlines();
    const snapshot = { ...this.settings };
    this.saveQueue = this.saveQueue.catch(() => void 0).then(() => this.saveData(snapshot));
    return this.saveQueue.catch((error) => {
      console.error("Knowledge Space settings save failed", error);
      new import_obsidian4.Notice("\u7B46\u8A18\u5916\u89C0\u5132\u5B58\u5931\u6557\uFF0C\u8ACB\u78BA\u8A8D\u5132\u5B58\u7A7A\u9593\u3002");
    });
  }
  async importBackground(file) {
    var _a;
    const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };
    const ext = extensions[file.type];
    if (!ext || file.size > 10 * 1024 * 1024) throw new Error("\u8ACB\u9078\u64C7 10 MB \u4EE5\u5167\u7684 PNG\u3001JPEG\u3001WebP \u6216 AVIF \u5716\u7247\u3002");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    const directory = (0, import_obsidian4.normalizePath)(`${(_a = this.manifest.dir) != null ? _a : `${this.app.vault.configDir}/plugins/${this.manifest.id}`}/assets`);
    if (!await this.app.vault.adapter.exists(directory)) await this.app.vault.adapter.mkdir(directory);
    const path = (0, import_obsidian4.normalizePath)(`${directory}/background-${Date.now()}.${ext}`);
    await this.app.vault.adapter.writeBinary(path, await file.arrayBuffer());
    await this.updateSettings({ background: "image", imagePath: path });
  }
};
var SpaceSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    new import_obsidian4.Setting(this.containerEl).setName("\u7B46\u8A18\u5916\u89C0\u8207\u80CC\u666F").setDesc("\u6240\u6709\u539F\u751F\u7B46\u8A18\u76F4\u63A5\u5957\u7528\u76F8\u540C\u5916\u89C0\u3002\u95B1\u8B80\u8207\u7DE8\u8F2F\u7167\u5E38\u4F7F\u7528\uFF0C\u539F\u6709\u7B46\u8A18\u5167\u5BB9\u8207\u7AE0\u7BC0\u6A21\u677F\u4FDD\u7559\u3002");
    new import_obsidian4.Setting(this.containerEl).setName("\u5957\u7528\u5230\u6240\u6709\u7B46\u8A18").addToggle((toggle) => toggle.setValue(this.plugin.settings.enabled).onChange((value) => {
      void this.plugin.updateSettings({ enabled: value });
    }));
    new import_obsidian4.Setting(this.containerEl).setName("\u5916\u89C0\u8207\u80CC\u666F").addButton((button) => button.setButtonText("\u958B\u555F\u5916\u89C0\u8A2D\u5B9A").onClick(() => this.plugin.openAppearance()));
  }
};
