import { MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, normalizePath } from 'obsidian';
import { AppearanceModal } from './modals';
import { NativeOutline } from './outline';
import { LocalFonts } from './local-fonts';
import { fontStack } from './font-stacks';
import { createResourceCache, cssUrl } from './resource-url';
import { DEFAULT_SETTINGS, normalizeSettings, type SpaceSettings } from './settings';

const APPEARANCE_PROPERTIES = ['--kn-font-size', '--kn-font', '--kn-background-strength', '--kn-background-blur', '--kn-panel-opacity', '--kn-background-image', '--kn-ink-strength', '--kn-content-width', '--kn-page-gutter'];
const LEGACY_VIEW = 'knowledge-space-reader';

export default class KnowledgeSpacePlugin extends Plugin {
  settings: SpaceSettings = { ...DEFAULT_SETTINGS };
  private documents = new Set<Document>();
  private appliedSettings = new WeakMap<Document, string>();
  private outlines = new Map<MarkdownView, NativeOutline>();
  private unloaded = false;
  private localFonts: LocalFonts | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private saveTimer: number | null = null;
  private pendingSave: { done: Promise<void>; resolve: () => void } | null = null;
  /** 背景圖的資源 URL 依路徑快取；每次重算會帶新的快取參數，令整頁背景重新載入而閃爍。 */
  readonly resourcePath = createResourceCache(path => this.app.vault.adapter.getResourcePath(path));

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.localFonts = new LocalFonts(this.app, this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    this.addRibbonIcon('palette', '筆記外觀與背景', () => this.openAppearance());
    this.addCommand({ id: 'reading-appearance', name: '筆記外觀與背景', callback: () => this.openAppearance() });
    this.addCommand({ id: 'show-note-outline', name: '顯示本篇目錄', callback: () => this.revealOutline() });
    this.addSettingTab(new SpaceSettingTab(this));
    // Obsidian does not unload plugins on quit; hand it the coalesced write so
    // the last slider change or imported background is never lost.
    this.registerEvent(this.app.workspace.on('quit', tasks => { this.flushSave(); tasks.addPromise(this.saveQueue.catch(() => undefined)); }));
    this.registerEvent(this.app.workspace.on('window-open', (_win, window) => {
      this.documents.add(window.document);
      this.applyDocument(window.document);
    }));
    this.registerEvent(this.app.workspace.on('window-close', (_win, window) => {
      this.clearDocument(window.document);
      this.documents.delete(window.document);
    }));
    this.registerEvent(this.app.workspace.on('layout-change', () => { this.applyAppearance(); this.syncOutlines(); }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.syncOutlines()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.syncOutlines()));
    this.registerEvent(this.app.metadataCache.on('changed', file => {
      for (const [view, outline] of this.outlines) if (view.file?.path === file.path) outline.refresh();
    }));
    this.register(() => {
      this.unloaded = true;
      // Persist any coalesced change before the plugin goes away.
      this.flushSave();
      for (const doc of this.documents) this.clearDocument(doc);
      this.documents.clear();
      this.localFonts?.dispose();
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
  private async migrateLegacyViews(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(LEGACY_VIEW)) {
      if (this.unloaded) return;
      const path = leaf.getViewState().state?.file;
      const file = typeof path === 'string' ? this.app.vault.getAbstractFileByPath(path) : null;
      if (!(file instanceof TFile) || file.extension !== 'md') continue;
      try { await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } }); }
      catch (error) { console.error('Knowledge Space native view migration failed', error); }
    }
  }

  private applyAppearance(): void {
    if (this.unloaded) return;
    this.documents.add(this.app.workspace.containerEl.ownerDocument);
    this.app.workspace.iterateAllLeaves(leaf => this.documents.add(leaf.view.containerEl.ownerDocument));
    for (const doc of this.documents) this.applyDocument(doc);
  }

  private syncOutlines(): void {
    if (this.unloaded) return;
    const present = new Set<MarkdownView>();
    if (this.settings.enabled) this.app.workspace.iterateAllLeaves(leaf => {
      if (!(leaf.view instanceof MarkdownView)) return;
      const view = leaf.view;
      present.add(view);
      let outline = this.outlines.get(view);
      if (outline && (outline.createdDocument !== view.contentEl.ownerDocument || !outline.isMounted)) {
        this.removeChild(outline); this.outlines.delete(view); outline = undefined;
      }
      if (!outline) {
        outline = new NativeOutline(view);
        this.outlines.set(view, outline);
        this.addChild(outline);
      } else outline.refresh();
    });
    for (const [view, outline] of this.outlines) {
      if (!present.has(view)) { this.removeChild(outline); this.outlines.delete(view); }
    }
  }

  private applyDocument(doc: Document): void {
    const body = doc.body;
    if (!body) return;
    const signature = JSON.stringify(this.settings);
    if (this.appliedSettings.get(doc) === signature) return;
    if (!this.settings.enabled) { this.clearDocument(doc); this.appliedSettings.set(doc, signature); return; }
    const s = this.settings;
    body.classList.add('kn-native-enabled');
    body.dataset.knTone = s.tone;
    body.dataset.knBackground = s.background;
    body.style.setProperty('--kn-font-size', `${s.fontSize}px`);
    // 字型堆疊與外觀設定的預覽卡共用（font-stacks.ts）。
    body.style.setProperty('--kn-font', fontStack(s.fontFamily));
    body.style.setProperty('--kn-ink-strength', `${s.inkStrength}%`);
    body.style.setProperty('--kn-content-width', `${s.contentWidth}px`);
    body.style.setProperty('--kn-page-gutter', `${s.pageGutter}px`);
    body.style.setProperty('--kn-background-strength', String(s.strength / 100));
    body.style.setProperty('--kn-background-blur', `${s.blur}px`);
    body.style.setProperty('--kn-panel-opacity', String(s.opacity / 100));
    // The setting is validated as a literal Vault-relative image path.
    body.style.setProperty('--kn-background-image', s.imagePath ? cssUrl(this.resourcePath(s.imagePath)) : 'none');
    if (s.fontFamily === 'jhenghei') void this.localFonts?.ensure(doc);
    else this.localFonts?.dispose(doc);
    this.appliedSettings.set(doc, signature);
  }

  private clearDocument(doc: Document): void {
    this.appliedSettings.delete(doc);
    this.localFonts?.dispose(doc);
    const body = doc.body;
    if (!body) return;
    body.classList.remove('kn-native-enabled');
    delete body.dataset.knTone;
    delete body.dataset.knBackground;
    for (const property of APPEARANCE_PROPERTIES) body.style.removeProperty(property);
  }

  revealOutline(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) { new Notice('請先開啟一篇筆記。'); return; }
    if (!this.settings.enabled) { new Notice('請先開啟「套用到所有筆記」。'); return; }
    this.syncOutlines();
    this.outlines.get(view)?.reveal();
  }

  openAppearance(onClose?: () => void): void { new AppearanceModal(this, onClose).open(); }

  updateSettings(patch: Partial<SpaceSettings>): Promise<void> {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    this.applyAppearance();
    this.syncOutlines();
    return this.scheduleSave();
  }

  /** Apply immediately; coalesce the data.json write so a slider drag persists once. */
  private scheduleSave(): Promise<void> {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    if (!this.pendingSave) {
      let resolve!: () => void;
      const done = new Promise<void>(r => { resolve = r; });
      this.pendingSave = { done, resolve };
    }
    const pending = this.pendingSave;
    this.saveTimer = window.setTimeout(() => this.flushSave(), 250);
    return pending.done;
  }

  private flushSave(): void {
    if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    const pending = this.pendingSave;
    if (!pending) return;
    this.pendingSave = null;
    const snapshot = { ...this.settings };
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.saveData(snapshot));
    void this.saveQueue
      .catch(error => { console.error('Knowledge Space settings save failed', error); new Notice('筆記外觀儲存失敗，請確認儲存空間。'); })
      .finally(() => pending.resolve());
  }

  async importBackground(file: File): Promise<void> {
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };
    const ext = extensions[file.type];
    if (!ext || file.size > 10 * 1024 * 1024) throw new Error('請選擇 10 MB 以內的 PNG、JPEG、WebP 或 AVIF 圖片。');
    const url = URL.createObjectURL(file);
    try { const image = new Image(); image.src = url; await image.decode(); }
    finally { URL.revokeObjectURL(url); }
    const directory = normalizePath(`${this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`}/assets`);
    if (!await this.app.vault.adapter.exists(directory)) await this.app.vault.adapter.mkdir(directory);
    const path = normalizePath(`${directory}/background-${Date.now()}.${ext}`);
    await this.app.vault.adapter.writeBinary(path, await file.arrayBuffer());
    await this.updateSettings({ background: 'image', imagePath: path });
  }
}

class SpaceSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: KnowledgeSpacePlugin) { super(plugin.app, plugin); }
  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl).setName('筆記外觀與背景').setDesc('所有原生筆記直接套用相同外觀。閱讀與編輯照常使用，原有筆記內容與章節模板保留。');
    new Setting(this.containerEl).setName('套用到所有筆記').addToggle(toggle => toggle.setValue(this.plugin.settings.enabled).onChange(value => { void this.plugin.updateSettings({ enabled: value }); }));
    // 面板關閉後重繪，讓這裡的總開關反映面板內的變更。
    new Setting(this.containerEl).setName('外觀與背景').addButton(button => button.setButtonText('開啟外觀設定').onClick(() => this.plugin.openAppearance(() => this.display())));
  }
}
