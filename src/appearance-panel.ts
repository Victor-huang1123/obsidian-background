import { Notice } from 'obsidian';
import { fontStack } from './font-stacks';
import { createResourceCache, cssUrl } from './resource-url';
import { DEFAULT_SETTINGS, type SpaceSettings } from './settings';

/**
 * 外觀設定面板需要的宿主能力。AppearanceModal 以外掛實作，測試以假物件實作。
 * `settings` 必須隨時反映最新設定（外掛以 getter 提供）。
 */
export interface AppearanceHost {
  readonly settings: SpaceSettings;
  updateSettings(patch: Partial<SpaceSettings>): Promise<void>;
  importBackground(file: File): Promise<void>;
  revealOutline(): void;
  resourcePath(path: string): string;
  close(): void;
}

export interface AppearancePanel {
  readonly rootEl: HTMLElement;
  /** 依宿主目前的設定重新同步所有控制項與預覽卡。 */
  sync(): void;
  /** 移除所有事件監聽並卸下面板。 */
  destroy(): void;
}

type RangeKey = 'fontSize' | 'inkStrength' | 'contentWidth' | 'pageGutter' | 'strength' | 'blur' | 'opacity';
interface RangeSpec { key: RangeKey; label: string; min: number; max: number; unit: string; hint?: string; }

// 範圍與 settings.ts 的 normalizeSettings 一致；超出的值仍由 normalizeSettings 夾限。
const READING_RANGES: readonly RangeSpec[] = [
  { key: 'fontSize', label: '正文字級', min: 12, max: 32, unit: 'px' },
  { key: 'inkStrength', label: '文字明暗', min: 35, max: 100, unit: '%', hint: '數值越低，文字越柔和。' },
  { key: 'contentWidth', label: '正文寬度上限', min: 360, max: 1600, unit: 'px', hint: '每行正文最寬的像素數；上限比目前視窗寬時，正文會鋪滿整張卡片，看不出差別。' },
];
const BACKGROUND_RANGES: readonly RangeSpec[] = [
  { key: 'strength', label: '背景濃度', min: 0, max: 100, unit: '%' },
  { key: 'blur', label: '背景柔焦', min: 0, max: 40, unit: 'px' },
  { key: 'opacity', label: '閱讀面板不透明度', min: 0, max: 100, unit: '%', hint: '0% 完全透明，100% 完全不透明；不影響文字。' },
];
const GUTTER_RANGE: RangeSpec = {
  key: 'pageGutter', label: '卡片外側左右留白', min: 0, max: 300, unit: 'px',
  hint: '0px 鋪滿閱讀區；數值越大，左右露出的背景越多。窄頁會自動縮減，避免正文被擠出。',
};

const FONT_CHOICES: readonly (readonly [SpaceSettings['fontFamily'], string])[] = [['sans', '清晰黑體'], ['serif', '書頁宋體'], ['jhenghei', '微軟正黑體']];
const TONE_CHOICES: readonly (readonly [SpaceSettings['tone'], string])[] = [['system', '跟隨 Obsidian'], ['dark', '深色'], ['light', '淺色']];
const BACKGROUND_PRESETS: readonly (readonly [SpaceSettings['background'], string])[] = [['aurora', '極光'], ['dusk', '暮色'], ['plain', '純色'], ['image', '本機圖片']];

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif';

let idCounter = 0;
const nextId = (): string => `kn-ap-${++idCounter}`;

/** 預覽卡用的字級：縮小後仍保留可辨識的下限。 */
export function previewFontSize(fontSize: number): number {
  return Math.max(9, Math.round(fontSize * 0.7 * 10) / 10);
}

/** 正文寬度上限 360–1600px 對應到預覽正文欄的 40–100%；欄寬置中，拖動時能直接看到欄位縮放。 */
export function previewWidth(contentWidth: number): number {
  return Math.round(40 + (contentWidth - 360) / (1600 - 360) * 60);
}

/** 左右留白 0–300px 對應到預覽卡的 6–22%；保留最小留白，讓背景在預覽裡永遠看得到。 */
export function previewGutter(pageGutter: number): number {
  return Math.round((6 + pageGutter / 300 * 16) * 10) / 10;
}

/**
 * 預覽卡的 CSS 變數（--kn-pv-*）。只設在預覽元素上，不碰 body 的 --kn-* 變數。
 * 柔焦依預覽尺寸減半，其餘比例與實際閱讀面相同。
 */
export function previewVariables(s: SpaceSettings, resourcePath: (path: string) => string): Record<string, string> {
  return {
    '--kn-pv-font': fontStack(s.fontFamily),
    '--kn-pv-font-size': `${previewFontSize(s.fontSize)}px`,
    '--kn-pv-ink': `${s.inkStrength}%`,
    '--kn-pv-width': `${previewWidth(s.contentWidth)}%`,
    '--kn-pv-gutter': `${previewGutter(s.pageGutter)}%`,
    '--kn-pv-strength': String(s.strength / 100),
    '--kn-pv-blur': `${s.blur / 2}px`,
    '--kn-pv-opacity': String(s.opacity / 100),
    '--kn-pv-image': s.imagePath ? cssUrl(resourcePath(s.imagePath)) : 'none',
  };
}

/**
 * 在 container 內建立外觀設定面板。控制項全部以原生 DOM 建構，
 * 事件監聽集中登記，destroy() 時一併移除。
 */
export function renderAppearancePanel(container: HTMLElement, host: AppearanceHost): AppearancePanel {
  const cleanups: (() => void)[] = [];
  const syncers: (() => void)[] = [];
  let disposed = false;
  // 同一張圖片只解析一次 URL：宿主每次可能回傳不同的快取參數，重設會讓圖片重新下載而閃爍。
  const resourceFor = createResourceCache(path => host.resourcePath(path));

  const listen = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, handler: (event: HTMLElementEventMap[K]) => void): void => {
    el.addEventListener(type, handler as EventListener);
    cleanups.push(() => el.removeEventListener(type, handler as EventListener));
  };
  const sync = (): void => { if (disposed) return; for (const apply of syncers) apply(); };
  /** 送出設定變更；宿主同步更新 settings 後立即重繪，儲存完成後再對齊一次。 */
  const commit = (patch: Partial<SpaceSettings>): void => {
    if (disposed) return;
    const saved = host.updateSettings(patch);
    sync();
    void saved.then(sync, sync);
  };

  const root = container.createDiv({ cls: 'kn-panel' });

  // ---- 共用控制項 ----------------------------------------------------------

  function group(parent: HTMLElement, name: string, title: string): HTMLElement {
    const id = nextId();
    const section = parent.createEl('section', { cls: 'kn-group', attr: { 'aria-labelledby': id } });
    section.dataset.group = name;
    section.createEl('h3', { cls: 'kn-group-title', text: title, attr: { id } });
    return section;
  }

  function field(parent: HTMLElement, label: string, options: { id?: string; hint?: string } = {}): HTMLElement {
    const row = parent.createDiv({ cls: 'kn-field' });
    if (options.id) row.createEl('label', { cls: 'kn-field-label', text: label, attr: { for: options.id } });
    else row.createSpan({ cls: 'kn-field-label', text: label });
    const control = row.createDiv({ cls: 'kn-field-control' });
    if (options.hint) row.createEl('p', { cls: 'kn-field-hint', text: options.hint });
    return control;
  }

  /** Obsidian 原生樣式的切換開關：checkbox-container + is-enabled。 */
  function createSwitch(parent: HTMLElement, options: { label: string; get: () => boolean; set: (value: boolean) => void }): HTMLElement {
    const el = parent.createDiv({ cls: 'checkbox-container', attr: { role: 'switch', tabindex: '0', 'aria-label': options.label, 'aria-checked': 'false' } });
    const input = el.createEl('input', { type: 'checkbox', attr: { tabindex: '-1', 'aria-hidden': 'true' } });
    const flip = (): void => options.set(!options.get());
    // preventDefault 取消 checkbox 的原生切換，狀態一律由 settings 決定。
    listen(el, 'click', event => { event.preventDefault(); flip(); });
    listen(el, 'keydown', event => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar') { event.preventDefault(); flip(); }
    });
    syncers.push(() => {
      const value = options.get();
      el.toggleClass('is-enabled', value);
      el.setAttribute('aria-checked', String(value));
      input.checked = value;
    });
    return el;
  }

  function createSegmented<T extends string>(parent: HTMLElement, options: { label: string; choices: readonly (readonly [T, string])[]; get: () => T; set: (value: T) => void }): HTMLElement {
    const el = parent.createDiv({ cls: 'kn-segmented', attr: { role: 'group', 'aria-label': options.label } });
    const buttons = options.choices.map(([value, text]) => {
      const button = el.createEl('button', { cls: 'kn-segment', text, attr: { type: 'button', 'aria-pressed': 'false', 'aria-label': `${options.label}：${text}` } });
      button.dataset.value = value;
      listen(button, 'click', () => { if (options.get() !== value) options.set(value); });
      return [value, button] as const;
    });
    syncers.push(() => {
      const current = options.get();
      for (const [value, button] of buttons) button.setAttribute('aria-pressed', String(value === current));
    });
    return el;
  }

  function createRange(parent: HTMLElement, spec: RangeSpec): void {
    const id = nextId();
    const control = field(parent, spec.label, { id, hint: spec.hint });
    const wrap = control.createDiv({ cls: 'kn-range' });
    const input = wrap.createEl('input', {
      type: 'range', cls: 'kn-range-input',
      attr: { id, min: String(spec.min), max: String(spec.max), step: '1', 'aria-label': spec.label },
    });
    const output = wrap.createEl('output', { cls: 'kn-range-value', attr: { for: id } });
    const format = (value: number): string => `${value}${spec.unit}`;
    listen(input, 'input', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      output.setText(format(value));
      input.setAttribute('aria-valuetext', format(value));
      commit({ [spec.key]: value });
    });
    syncers.push(() => {
      const value = host.settings[spec.key];
      if (input.value !== String(value)) input.value = String(value);
      input.setAttribute('aria-valuetext', format(value));
      output.setText(format(value));
    });
  }

  function createButton(parent: HTMLElement, text: string, onClick: () => void, cls = 'kn-button'): HTMLButtonElement {
    const button = parent.createEl('button', { cls, text, attr: { type: 'button' } });
    listen(button, 'click', onClick);
    return button;
  }

  // ---- 頂部：說明與總開關 -------------------------------------------------

  const head = root.createDiv({ cls: 'kn-panel-head' });
  const help = head.createEl('p', { cls: 'kn-panel-help' });
  // 不用 <label>：Obsidian 的 checkbox-container 內含真正的 checkbox，label 的啟動行為會再送一次 click 而抵銷切換。
  const master = head.createDiv({ cls: 'kn-master' });
  const masterLabel = master.createSpan({ cls: 'kn-master-label', text: '套用到所有筆記' });
  createSwitch(master, { label: '套用到所有筆記', get: () => host.settings.enabled, set: value => commit({ enabled: value }) });
  listen(masterLabel, 'click', () => commit({ enabled: !host.settings.enabled }));
  syncers.push(() => {
    const enabled = host.settings.enabled;
    root.dataset.enabled = String(enabled);
    help.setText(enabled
      ? '調整會立即套用到所有筆記的閱讀模式與即時預覽，並自動儲存。'
      : '目前未套用：筆記維持 Obsidian 原本外觀，這裡的調整仍會儲存。');
  });

  // ---- 即時預覽卡 ----------------------------------------------------------

  const preview = root.createDiv({ cls: 'kn-preview', attr: { role: 'img', 'aria-label': '目前外觀的即時預覽' } });
  preview.createDiv({ cls: 'kn-preview-ambient' });
  const page = preview.createDiv({ cls: 'kn-preview-page' });
  // 正文欄的寬度跟著「正文寬度上限」縮放並置中，和實際筆記的可讀行寬一致。
  const column = page.createDiv({ cls: 'kn-preview-column' });
  column.createDiv({ cls: 'kn-preview-title', text: '筆記標題' });
  column.createEl('p', { cls: 'kn-preview-text', text: '這一段正文用來預覽字體、字級、文字明暗與每行的寬度；上限越小，欄位越窄、換行越早。' });
  const second = column.createEl('p', { cls: 'kn-preview-text' });
  second.createSpan({ text: '連結會顯示成 ' });
  second.createSpan({ cls: 'kn-preview-link', text: '[[另一篇筆記]]' });
  second.createSpan({ text: ' 的樣子。' });
  const badge = preview.createSpan({ cls: 'kn-preview-badge', text: '預覽' });
  syncers.push(() => {
    const s = host.settings;
    for (const [name, value] of Object.entries(previewVariables(s, resourceFor))) {
      if (preview.style.getPropertyValue(name) !== value) preview.style.setProperty(name, value);
    }
    preview.dataset.tone = s.tone;
    preview.dataset.background = s.background;
    preview.dataset.enabled = String(s.enabled);
    badge.setText(s.enabled ? '預覽' : '預覽（目前未套用）');
  });

  // ---- 閱讀 ---------------------------------------------------------------

  const reading = group(root, 'reading', '閱讀');
  createSegmented(field(reading, '字體'), {
    label: '字體', choices: FONT_CHOICES,
    get: () => host.settings.fontFamily, set: value => commit({ fontFamily: value }),
  });
  for (const spec of READING_RANGES) createRange(reading, spec);
  createSegmented(field(reading, '色系'), {
    label: '色系', choices: TONE_CHOICES,
    get: () => host.settings.tone, set: value => commit({ tone: value }),
  });
  reading.createEl('p', { cls: 'kn-group-note', text: '微軟正黑體使用裝置上可用的字型；未安裝時改用系統黑體。外掛不附帶商用字型檔案。' });

  // ---- 背景 ---------------------------------------------------------------

  const background = group(root, 'background', '背景');
  const fileInput = background.createEl('input', {
    type: 'file', cls: 'kn-file-input',
    attr: { accept: IMAGE_ACCEPT, hidden: '', tabindex: '-1', 'aria-hidden': 'true' },
  });
  let importing = false;
  const pickImage = (): void => { if (!importing) fileInput.click(); };

  const cards = background.createDiv({ cls: 'kn-bg-cards', attr: { role: 'group', 'aria-label': '背景樣式' } });
  const cardEls = BACKGROUND_PRESETS.map(([preset, label]) => {
    const card = cards.createEl('button', { cls: 'kn-bg-card', attr: { type: 'button', 'aria-pressed': 'false', 'aria-label': `背景：${label}` } });
    card.dataset.preset = preset;
    const swatch = card.createSpan({ cls: 'kn-swatch' });
    swatch.dataset.preset = preset;
    const caption = card.createSpan({ cls: 'kn-bg-card-label', text: label });
    listen(card, 'click', () => {
      if (preset === 'image' && !host.settings.imagePath) { pickImage(); return; }
      if (host.settings.background !== preset) commit({ background: preset });
    });
    return { preset, card, swatch, caption };
  });
  const imageCard = cardEls[cardEls.length - 1];

  const imageActions = background.createDiv({ cls: 'kn-row kn-image-actions' });
  imageActions.createEl('p', { cls: 'kn-note', text: '圖片副本存放在外掛資料夾，本外掛不會上傳；Vault 同步工具可能同步此資料夾。' });
  const imageButtons = imageActions.createDiv({ cls: 'kn-row-buttons' });
  const replaceButton = createButton(imageButtons, '更換圖片', pickImage);
  // 只移除圖片；目前若正在使用圖片才退回極光，其他預設（暮色／純色）維持不變。
  const clearButton = createButton(imageButtons, '清除圖片', () => commit({ imagePath: '', ...(host.settings.background === 'image' ? { background: 'aurora' as const } : {}) }));

  const setBusy = (busy: boolean): void => {
    imageCard.card.disabled = busy;
    replaceButton.disabled = busy;
    clearButton.disabled = busy;
    if (busy) imageCard.card.setAttribute('aria-busy', 'true');
    else imageCard.card.removeAttribute('aria-busy');
  };
  listen(fileInput, 'change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file || importing) return;
    importing = true;
    setBusy(true);
    void host.importBackground(file)
      .catch(error => { new Notice(`無法設定背景：${error instanceof Error ? error.message : String(error)}`); })
      .finally(() => {
        importing = false;
        if (disposed) return;
        setBusy(false);
        sync();
      });
  });
  syncers.push(() => {
    const s = host.settings;
    const hasImage = !!s.imagePath;
    for (const { preset, card } of cardEls) card.setAttribute('aria-pressed', String(s.background === preset));
    imageCard.card.dataset.empty = String(!hasImage);
    imageCard.card.setAttribute('aria-label', hasImage ? '背景：本機圖片' : '選擇本機圖片作為背景');
    imageCard.caption.setText(hasImage ? '本機圖片' : '選擇圖片');
    const swatchImage = hasImage ? cssUrl(resourceFor(s.imagePath)) : '';
    if (imageCard.swatch.style.getPropertyValue('background-image') !== swatchImage) {
      if (swatchImage) imageCard.swatch.style.setProperty('background-image', swatchImage);
      else imageCard.swatch.style.removeProperty('background-image');
    }
    if (hasImage) imageActions.removeAttribute('hidden');
    else imageActions.setAttribute('hidden', '');
  });
  for (const spec of BACKGROUND_RANGES) createRange(background, spec);

  // ---- 目錄 ---------------------------------------------------------------

  const outline = group(root, 'outline', '目錄');
  const outlineRow = outline.createDiv({ cls: 'kn-row' });
  outlineRow.createEl('p', { cls: 'kn-note', text: '筆記左上角「前進箭頭」旁的目錄圖示可展開或收合本篇章節：寬頁停靠在左側，窄頁從左上角浮出。' });
  createButton(outlineRow, '顯示目前目錄', () => { host.close(); host.revealOutline(); });

  // ---- 進階（預設收合） -----------------------------------------------------

  const advanced = root.createEl('details', { cls: 'kn-group kn-advanced' });
  advanced.dataset.group = 'advanced';
  advanced.createEl('summary', { cls: 'kn-group-title', text: '進階' });
  createRange(advanced, GUTTER_RANGE);
  const resetRow = advanced.createDiv({ cls: 'kn-row' });
  resetRow.createEl('p', { cls: 'kn-note', text: '重設會把字體、背景與各項數值恢復為預設；「套用到所有筆記」與已匯入的圖片會保留。' });
  createButton(resetRow, '重設外觀', () => commit({ ...DEFAULT_SETTINGS, enabled: host.settings.enabled, imagePath: host.settings.imagePath }));

  // ---- 底部 ---------------------------------------------------------------

  const actions = root.createDiv({ cls: 'kn-panel-actions' });
  createButton(actions, '完成', () => host.close(), 'mod-cta');

  sync();

  return {
    rootEl: root,
    sync,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      root.remove();
    },
  };
}
