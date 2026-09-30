# Obsidian Background

讓每一篇 Obsidian 筆記都有舒適的字體、柔和的背景與隨手可用的章節目錄。

Obsidian Background 直接套用在 Obsidian 原生筆記的**閱讀模式與即時預覽**，保留既有 Markdown、筆記模板、WikiLinks、公式與編輯流程。打開筆記即可使用，不需要轉換檔案或開啟另一個閱讀器。

[下載最新版](https://github.com/Victor-huang1123/obsidian-background/releases/latest) · [回報問題](https://github.com/Victor-huang1123/obsidian-background/issues) · [English](#english)

## 可以做什麼

- **統一筆記外觀**：所有原生 Markdown 筆記套用相同的字體、字級、文字明暗與正文寬度。
- **自訂背景**：內建極光、暮色、純色背景，也能選擇本機圖片，調整背景濃度與柔焦。
- **調整閱讀面板**：面板不透明度與文字明暗分開控制；外側左右留白可逐像素調整，讓背景露出你想要的範圍。
- **本篇目錄**：依目前筆記的實際標題產生編號目錄，點擊跳到章節，並標示目前閱讀位置。
- **保留原有筆記**：不重寫 Markdown、不新增模板欄位，也不替換 Obsidian 的 Markdown 渲染器。

外掛介面目前使用**繁體中文**。

## 安裝

需要 Obsidian **1.6.0 或以上版本**。目前請從 GitHub Releases 手動安裝。

1. 前往[最新版本](https://github.com/Victor-huang1123/obsidian-background/releases/latest)，下載 `obsidian-background-0.3.3.zip`。
2. 解壓縮，將其中的 `knowledge-space` 資料夾放入 Vault 的 `.obsidian/plugins/`。
3. 重新啟動 Obsidian，或重新載入外掛。
4. 到「設定 → 社群外掛」，允許使用社群外掛，並啟用 **Obsidian Background**。

外掛的顯示名稱是 Obsidian Background；為了保留既有安裝與設定的相容性，外掛 ID 和安裝資料夾仍使用 **`knowledge-space`**。安裝完成後，目錄應如下：

```text
Your Vault/
└── .obsidian/
    └── plugins/
        └── knowledge-space/
            ├── main.js
            ├── manifest.json
            └── styles.css
```

也可以在 Release 頁面分別下載 `main.js`、`manifest.json`、`styles.css`，放入同一個 `knowledge-space` 資料夾。若你的 Vault 使用自訂設定資料夾，請以該資料夾取代 `.obsidian`。

更新時關閉外掛，替換上述三個檔案後再啟用。保留現有的 `data.json` 與 `assets/`，就能保留外觀設定和匯入的背景。

## 開始使用

點左側工具列的**調色盤圖示「筆記外觀與背景」**，或從命令面板執行同名命令，開啟外觀設定。設定會自動儲存，也可以從外掛的設定頁進入。

筆記上方工具列的**前進箭頭旁**有「本篇目錄」圖示，可以展開或收合目錄。寬頁的目錄停靠在左側；窄頁則從左上方浮出，選擇章節後自動收合。也能從命令面板執行「顯示本篇目錄」。沒有章節標題的筆記會顯示空目錄提示。

關閉「套用到所有筆記」即可移除外掛套用的外觀與目錄，恢復原本的筆記介面。

## 外觀設定

| 設定 | 範圍或選項 | 用途 |
| --- | --- | --- |
| 字體 | 清晰黑體、書頁宋體、微軟正黑體 | 選擇正文的字體風格 |
| 正文字級 | 12–32px | 放大或縮小正文 |
| 文字明暗 | 35–100% | 數值越低，文字越柔和 |
| 正文寬度上限 | 360–1600px | 控制每行文字的最大寬度 |
| 卡片外側左右留白 | 每側 0–300px | 調整面板左右露出的背景範圍 |
| 閱讀面板不透明度 | 0–100% | 0% 透明、100% 不透明，不影響文字透明度 |
| 背景 | 極光、暮色、純色、本機圖片 | 選擇背景樣式 |
| 背景濃度 | 0–100% | 調整背景效果的強度 |
| 背景柔焦 | 0–40px | 模糊背景 |
| 色系 | 跟隨 Obsidian、深色、淺色 | 選擇面板與文字色系 |

**左右留白設為 0px 時，面板會鋪滿可用的筆記區域。**數值越大，兩側露出的背景越多；窄視窗會自動縮減實際留白，保留可閱讀的寬度。面板上下貼齊原生筆記區域，正文內側另外保留折疊按鈕與捲軸所需的空間。

左右留白與面板不透明度是兩個獨立設定：若希望完全遮住面板後方的背景，請同時將左右留白設為 **0px**、面板不透明度設為 **100%**。

### 字體

字體會依裝置上可用的字型套用。選擇「微軟正黑體」時，若裝置沒有可用的 Microsoft JhengHei，會依序使用其他系統黑體。此專案與 Release **不附帶 Microsoft 字型檔**。

外掛也支援使用者自行提供、具有適當使用權限的本機字型：將一般與粗體檔案分別放在外掛資料夾的 `assets/fonts/MSJH.ttf` 和 `assets/fonts/MSJHBD.ttf`，重新啟用外掛後選擇「微軟正黑體」。這些檔案只載入 Obsidian 文件，不會安裝到作業系統。

### 背景與資料

支援 **PNG、JPEG、WebP、AVIF**，單張圖片最多 **10 MB**。匯入時，外掛會在自己的 `assets/` 資料夾儲存一份圖片副本；外觀設定儲存在外掛的 `data.json`。

外掛不會自行上傳圖片或筆記，也沒有遙測或遠端服務需求。若你使用 Vault 同步工具，該工具仍可能同步外掛資料夾。選擇「清除選擇」只會取消目前背景設定，不會刪除已匯入的圖片檔案。

## 相容性與回報

已在 **macOS 桌面版 Obsidian** 驗證閱讀模式與即時預覽。行動版尚未驗證；第三方主題、CSS snippets 與未來的 Obsidian 介面變更可能影響版面。

如遇到問題，請在 [Issues](https://github.com/Victor-huang1123/obsidian-background/issues) 提供 Obsidian 版本、作業系統、主題、閱讀／編輯模式與重現步驟。若附上截圖或範例筆記，請先移除私人內容。

## 開發

需要 **Node.js 22.12 以上版本（或 24 以上版本）**與 npm。

```sh
git clone https://github.com/Victor-huang1123/obsidian-background.git
cd obsidian-background
npm ci
npm test
npm run build
```

`npm run build` 會先執行 TypeScript 檢查，再產生 `main.js`，並將 `native.css`、`outline.css`、`modal.css` 合併為 `styles.css`。將建置後的三個外掛檔案複製到測試 Vault 的外掛資料夾，即可在 Obsidian 中驗證。

## 授權

程式碼採用 [MIT License](LICENSE)。使用者自行提供的背景圖片與字型，其權利與授權依各自來源為準。本專案為社群外掛，與 Obsidian 官方無隸屬關係。

## English

**Obsidian Background** brings readable typography, customizable backgrounds and a chapter outline to native Obsidian notes. It applies to Reading Mode and Live Preview while preserving your Markdown, templates, links, math rendering and normal editing workflow. The plugin interface is currently in Traditional Chinese.

- Adjust font size (12–32px), text strength, line width and panel opacity.
- Choose a built-in background or import a local PNG, JPEG, WebP or AVIF image up to 10 MB.
- Set outside spacing to **0–300px per side**. At 0px the panel fills the available note area; narrow panes reduce effective spacing to keep the note usable. Opacity is independent: use 100% opacity to hide the background behind the panel completely.
- Open the automatic chapter outline beside the forward navigation arrow. It docks on the left in wide panes and opens as an overlay in narrow panes.
- Use Microsoft JhengHei when available, with system-font fallbacks. No proprietary font files are distributed.

**Install:** download `obsidian-background-0.3.3.zip` from the [latest release](https://github.com/Victor-huang1123/obsidian-background/releases/latest), extract `knowledge-space/` into your Vault's `.obsidian/plugins/`, reload Obsidian and enable **Obsidian Background** under Community Plugins. The plugin ID and installation folder remain **`knowledge-space`** for compatibility with existing installations. Alternatively, place the release's `main.js`, `manifest.json` and `styles.css` in that folder. Obsidian 1.6.0 or newer is required. Preserve `data.json` and `assets/` when updating.

**Use:** open the palette icon in the left ribbon to adjust appearance. Turn off 「套用到所有筆記」 to remove the plugin's styling and outline. Imported backgrounds and settings stay in the plugin folder; the plugin makes no upload or telemetry requests. Your Vault sync tool may still sync those files.

**Compatibility:** Reading Mode and Live Preview have been tested on macOS desktop. Mobile has not been verified, and custom themes or CSS snippets may affect layout.

**Development:** use Node.js 22.12+ (or 24+) and npm, then run `npm ci`, `npm test` and `npm run build`. Source code is in `src/`; the build generates `main.js` and `styles.css`.

**License:** [MIT](LICENSE). User-provided images and fonts retain their respective licenses. This community plugin is not affiliated with Obsidian.
