import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isSafeImagePath, normalizeSettings } from "../src/settings";

describe("saved native appearance settings", () => {
  it.each([undefined, null, false, 20, "settings", []])("recovers from a non-object settings payload (%s)", raw => {
    expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("upgrades legacy reader settings without losing the chosen appearance", () => {
    expect(normalizeSettings({ fontSize: 22, background: "dusk", followActive: false }))
      .toMatchObject({ fontSize: 22, background: "dusk", enabled: true });
    expect(normalizeSettings({ enabled: false }).enabled).toBe(false);
  });

  it("rejects invalid field types and non-finite numeric values independently", () => {
    expect(normalizeSettings({
      fontSize: "24",
      fontFamily: ["serif"],
      tone: "sepia",
      background: {},
      strength: Number.NaN,
      blur: Number.POSITIVE_INFINITY,
      opacity: Number.NEGATIVE_INFINITY,
      imagePath: 42,
      enabled: "false",
    })).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps persisted out-of-range controls while retaining valid preferences", () => {
    const settings = normalizeSettings({
      fontSize: 90,
      fontFamily: "serif",
      tone: "system",
      background: "dusk",
      strength: -30,
      blur: 1000,
      opacity: 0,
      enabled: false,
    });
    expect(settings).toMatchObject({
      fontSize: 32, fontFamily: "serif", tone: "system", background: "dusk",
      strength: 0, blur: 40, opacity: 0, enabled: false,
    });
  });

  it("accepts transparent panels, smaller dimmer text and JhengHei without changing old preferences", () => {
    const saved = normalizeSettings({ opacity: 0, fontSize: 12, inkStrength: 50, fontFamily: "jhenghei", contentWidth: 680, pageGutter: 8 });
    expect(saved).toMatchObject({ opacity: 0, fontSize: 12, inkStrength: 50, fontFamily: "jhenghei", contentWidth: 680, pageGutter: 8 });
    expect(normalizeSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(normalizeSettings({ opacity: 90, fontSize: 19 })).toMatchObject({ opacity: 90, fontSize: 19, inkStrength: 100, contentWidth: 760, pageGutter: 24 });
  });

  it("clamps layout and ink controls while rejecting malformed persisted values", () => {
    expect(normalizeSettings({ inkStrength: -1, contentWidth: 2, pageGutter: 900 })).toMatchObject({ inkStrength: 35, contentWidth: 360, pageGutter: 300 });
    expect(normalizeSettings({ inkStrength: NaN, contentWidth: Infinity, pageGutter: "30" })).toMatchObject({ inkStrength: 100, contentWidth: 760, pageGutter: 24 });
  });

  it.each([150, 240, 300])("retains expanded outside card spacing after save/reload: %spx", pageGutter => {
    const saved = normalizeSettings({ pageGutter, contentWidth: 968, fontSize: 15, opacity: 85 });
    expect(saved).toMatchObject({ pageGutter, contentWidth: 968, fontSize: 15, opacity: 85 });
    expect(normalizeSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("normalizes fractional controls and remains stable after save/reload", () => {
    const first = normalizeSettings({ fontSize: 21.6, strength: 62.2, blur: 10.8, opacity: 92.5 });
    expect([first.fontSize, first.strength, first.blur, first.opacity]).toEqual([22, 62, 11, 93]);
    expect(normalizeSettings(JSON.parse(JSON.stringify(first)))).toEqual(first);
  });

  it("preserves an image background only when its literal Vault path is valid", () => {
    const settings = normalizeSettings({
      imagePath: "  .obsidian/plugins/knowledge-space/assets/背景 image.webp  ",
      background: "image",
    });
    expect(settings.imagePath).toBe(".obsidian/plugins/knowledge-space/assets/背景 image.webp");
    expect(settings.background).toBe("image");
  });

  it("falls back to aurora when image mode has no usable asset path", () => {
    expect(normalizeSettings({ background: "image" }).background).toBe("aurora");
    expect(normalizeSettings({ background: "image", imagePath: "https://example.com/picture.png" }))
      .toMatchObject({ background: "aurora", imagePath: "" });
  });

  it("returns independent settings objects without mutating the input or defaults", () => {
    const raw = { fontSize: 999, imagePath: "../outside.png" };
    const result = normalizeSettings(raw);
    result.fontSize = 18;
    expect(raw).toEqual({ fontSize: 999, imagePath: "../outside.png" });
    expect(normalizeSettings(undefined).fontSize).toBe(20);
  });
});

describe("background image paths", () => {
  it.each([
    "Assets/reading background.png",
    "照片/圖譜.JPG",
    "picture.jpeg",
    ".obsidian/plugins/knowledge-space/assets/local.avif",
  ])("accepts a Vault image: %s", path => {
    expect(isSafeImagePath(path)).toBe(true);
  });

  it.each([
    "", "/tmp/image.png", "//example.com/image.png", "../image.png", "images/../image.png",
    "images/./image.png", "images//image.png", "C:\\images\\image.png", "images\\image.png",
    "https://example.com/image.png", "file:///tmp/image.png", "data:image/png;base64,AAAA",
    "images/a\".png", "images/a'.png", "images/a`.png", "images/a\n.png", "images/a\r.png",
    "images/a\u0000.png", "images/a\u007f.png", "images/%2e%2e/image.png", "images/%0a.png",
    "images/a.png?anything=.png", "images/a.png#fragment.png", "image.svg", "image.md",
    " image.png", "image.png ",
  ])("rejects unsafe or unsupported persisted path: %s", path => {
    expect(isSafeImagePath(path)).toBe(false);
    expect(normalizeSettings({ background: "image", imagePath: path }).background)
      .toBe(path.trim() === "image.png" ? "image" : "aurora");
  });
});
