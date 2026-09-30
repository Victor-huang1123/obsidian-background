export interface SpaceSettings {
  fontSize: number;
  fontFamily: "sans" | "serif" | "jhenghei";
  inkStrength: number;
  contentWidth: number;
  pageGutter: number;
  tone: "system" | "dark" | "light";
  background: "aurora" | "dusk" | "plain" | "image";
  strength: number;
  blur: number;
  opacity: number;
  imagePath: string;
  enabled: boolean;
}

export const DEFAULT_SETTINGS: Readonly<SpaceSettings> = Object.freeze({
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
  enabled: true,
});

/** Accept a literal Vault-relative image path, never a URL or traversal path. */
export function isSafeImagePath(path: string): boolean {
  if (!path || path !== path.trim() || path.startsWith("/")) return false;
  // Keep paths literal: encoded separators/control characters must not acquire
  // a second meaning when converted into an Obsidian resource URL or CSS URL.
  if (path.includes("..") || /[\\:"'`%?#<>\u0000-\u001f\u007f]/.test(path)) return false;
  if (path.split("/").some(segment => !segment || segment === ".")) return false;
  return /\.(?:png|jpe?g|webp|avif)$/i.test(path);
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

/** Validate saved plugin data before it reaches CSS or resource resolution. */
export function normalizeSettings(raw: unknown): SpaceSettings {
  const saved: Record<string, unknown> = raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
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
    enabled: typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_SETTINGS.enabled,
  };
}
