/**
 * 把 Vault 相對路徑換成可供 CSS 使用的資源 URL，並依路徑快取結果。
 *
 * Obsidian 桌面版對 `.obsidian/` 內的檔案（外掛資料夾裡的背景圖）不在檔案索引中，
 * `adapter.getResourcePath()` 會改以 `Date.now()` 當快取參數，每次呼叫都得到不同的 URL。
 * 若每次重繪都重新寫入 background-image，瀏覽器就會重新下載圖片而閃爍。
 * 同一條路徑只解析一次即可；更換圖片時檔名含時間戳，路徑不同自然重新解析。
 */
export type ResourceResolver = (path: string) => string;

export function createResourceCache(resolve: ResourceResolver): ResourceResolver {
  let cached: { path: string; url: string } | null = null;
  return (path: string): string => {
    if (!cached || cached.path !== path) cached = { path, url: resolve(path) };
    return cached.url;
  };
}

/** 資源 URL 以 JSON 字串包裝，避免引號或括號改變 CSS 的意義。 */
export function cssUrl(resource: string): string { return `url(${JSON.stringify(resource)})`; }
