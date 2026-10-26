import { beforeEach, describe, expect, it, vi } from 'vitest';
// vitest 將 'obsidian' 別名到同一個假模組；直接匯入可取得 messages 的型別。
import { Notice } from './mocks/obsidian';
import { TestDocument, TestElement } from './mocks/outline-dom';
import { previewFontSize, previewGutter, previewVariables, previewWidth, renderAppearancePanel, type AppearanceHost } from '../src/appearance-panel';
import { DEFAULT_SETTINGS, normalizeSettings, type SpaceSettings } from '../src/settings';

/** 使用者 Vault 內 data.json 的實際內容，用來確認面板能原樣呈現既有設定。 */
const VAULT_SETTINGS: SpaceSettings = {
  fontSize: 15, fontFamily: 'serif', inkStrength: 90, contentWidth: 1600, pageGutter: 65,
  tone: 'dark', background: 'image', strength: 40, blur: 0, opacity: 85,
  imagePath: '.obsidian/plugins/knowledge-space/assets/background-1.webp', enabled: true,
};

const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

function fixture(initial: Partial<SpaceSettings> = {}) {
  const document = new TestDocument();
  const container = document.body.createDiv('modal-content');
  const host = {
    settings: normalizeSettings({ ...DEFAULT_SETTINGS, ...initial }),
    updateSettings: vi.fn((patch: Partial<SpaceSettings>) => {
      host.settings = normalizeSettings({ ...host.settings, ...patch });
      return Promise.resolve();
    }),
    importBackground: vi.fn((_file: File) => Promise.resolve()),
    revealOutline: vi.fn(),
    resourcePath: vi.fn((path: string) => `app://vault/${path}`),
    close: vi.fn(),
  };
  const panel = renderAppearancePanel(container as unknown as HTMLElement, host as unknown as AppearanceHost);
  const root = panel.rootEl as unknown as TestElement;
  const groups = Object.fromEntries(root.querySelectorAll('.kn-group').map(group => [group.dataset.group, group]));
  const preview = root.find('kn-preview')!;
  const rangeFor = (label: string): { input: TestElement; output: TestElement } => {
    const input = root.querySelectorAll('input[type="range"]').find(el => el.attrs['aria-label'] === label)!;
    const output = input.parent!.querySelector('output')!;
    return { input, output };
  };
  const segmentFor = (group: string, text: string): TestElement =>
    root.querySelectorAll('.kn-segmented').find(el => el.attrs['aria-label'] === group)!.children.find(child => child.textContent === text)!;
  const cardFor = (preset: string): TestElement => root.querySelectorAll('.kn-bg-card').find(card => card.dataset.preset === preset)!;
  return { document, container, host, panel, root, groups, preview, rangeFor, segmentFor, cardFor };
}

describe('appearance panel structure', () => {
  it('renders the master switch, preview card, four groups and a done button', () => {
    const { root, groups, preview } = fixture();
    expect(Object.keys(groups)).toEqual(['reading', 'background', 'outline', 'advanced']);
    expect(groups.reading.find('kn-group-title')!.textContent).toBe('閱讀');
    expect(groups.background.find('kn-group-title')!.textContent).toBe('背景');
    expect(groups.outline.find('kn-group-title')!.textContent).toBe('目錄');
    expect(groups.advanced.tagName).toBe('details');
    expect(groups.advanced.open).toBe(false);
    expect(groups.advanced.children[0].tagName).toBe('summary');
    expect(groups.advanced.children[0].textContent).toBe('進階');
    // 頂部總開關：Obsidian 原生樣式 + switch 語意
    const master = root.find('kn-master')!;
    expect(master.findText('套用到所有筆記')).toBeDefined();
    const toggle = master.find('checkbox-container')!;
    expect(toggle.attrs.role).toBe('switch');
    expect(toggle.attrs['aria-checked']).toBe('true');
    expect(toggle.hasClass('is-enabled')).toBe(true);
    expect(toggle.children[0].type).toBe('checkbox');
    expect(toggle.children[0].checked).toBe(true);
    // 預覽卡在分群之前
    expect(root.children.indexOf(preview)).toBeLessThan(root.children.indexOf(groups.reading));
    expect(preview.find('kn-preview-ambient')).toBeDefined();
    // 正文欄包住標題與段落，寬度由 --kn-pv-width 控制
    const column = preview.find('kn-preview-page')!.find('kn-preview-column')!;
    expect(column.find('kn-preview-title')).toBeDefined();
    expect(column.find('kn-preview-link')!.textContent).toBe('[[另一篇筆記]]');
    const done = root.find('kn-panel-actions')!.children[0];
    expect(done.hasClass('mod-cta')).toBe(true);
    expect(done.textContent).toBe('完成');
  });

  it('gives every control a visible label and an aria-label, with sliders in the right groups', () => {
    const { root, groups } = fixture();
    const labels = (group: TestElement): string[] => group.querySelectorAll('input[type="range"]').map(el => el.attrs['aria-label']);
    expect(labels(groups.reading)).toEqual(['正文字級', '文字明暗', '正文寬度上限']);
    expect(labels(groups.background)).toEqual(['背景濃度', '背景柔焦', '閱讀面板不透明度']);
    expect(labels(groups.advanced)).toEqual(['卡片外側左右留白']);
    for (const input of root.querySelectorAll('input[type="range"]')) {
      const label = input.closest('.kn-field')!.querySelector('label')!;
      expect(label.attrs.for).toBe(input.attrs.id);
      expect(label.textContent).toBe(input.attrs['aria-label']);
      expect(input.parent!.querySelector('output')!.attrs.for).toBe(input.attrs.id);
    }
    const segmented = root.querySelectorAll('.kn-segmented');
    expect(segmented.map(el => el.attrs['aria-label'])).toEqual(['字體', '色系']);
    expect(segmented[0].children.map(el => el.textContent)).toEqual(['清晰黑體', '書頁宋體', '微軟正黑體']);
    expect(segmented[1].children.map(el => el.textContent)).toEqual(['跟隨 Obsidian', '深色', '淺色']);
    for (const button of segmented.flatMap(el => el.children)) {
      expect(button.attrs.type).toBe('button');
      expect(button.attrs['aria-pressed']).toMatch(/^(true|false)$/);
      expect(button.attrs['aria-label']).toContain(button.textContent);
    }
    expect(root.querySelectorAll('.kn-bg-card').map(card => card.find('kn-bg-card-label')!.textContent)).toEqual(['極光', '暮色', '純色', '選擇圖片']);
    expect(groups.outline.findText('顯示目前目錄', 'button')).toBeDefined();
    expect(groups.advanced.findText('重設外觀', 'button')).toBeDefined();
  });

  it('shows the saved Vault settings exactly as stored', () => {
    const { rangeFor, segmentFor, cardFor, preview, root } = fixture(VAULT_SETTINGS);
    expect(rangeFor('正文字級').input.value).toBe('15');
    expect(rangeFor('正文字級').output.textContent).toBe('15px');
    expect(rangeFor('文字明暗').output.textContent).toBe('90%');
    expect(rangeFor('正文寬度上限').output.textContent).toBe('1600px');
    expect(rangeFor('卡片外側左右留白').output.textContent).toBe('65px');
    expect(rangeFor('背景濃度').output.textContent).toBe('40%');
    expect(rangeFor('背景柔焦').output.textContent).toBe('0px');
    expect(rangeFor('閱讀面板不透明度').output.textContent).toBe('85%');
    expect(segmentFor('字體', '書頁宋體').attrs['aria-pressed']).toBe('true');
    expect(segmentFor('色系', '深色').attrs['aria-pressed']).toBe('true');
    expect(cardFor('image').attrs['aria-pressed']).toBe('true');
    expect(cardFor('image').find('kn-bg-card-label')!.textContent).toBe('本機圖片');
    expect(cardFor('image').find('kn-swatch')!.style.getPropertyValue('background-image'))
      .toBe('url("app://vault/.obsidian/plugins/knowledge-space/assets/background-1.webp")');
    expect(root.find('kn-image-actions')!.attrs.hidden).toBeUndefined();
    expect(preview.dataset.background).toBe('image');
    expect(preview.style.getPropertyValue('--kn-pv-image')).toBe('url("app://vault/.obsidian/plugins/knowledge-space/assets/background-1.webp")');
  });
});

describe('appearance panel interactions', () => {
  it('switches font and tone through the segmented controls and updates aria-pressed', () => {
    const { host, segmentFor } = fixture();
    segmentFor('字體', '書頁宋體').emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ fontFamily: 'serif' });
    expect(segmentFor('字體', '書頁宋體').attrs['aria-pressed']).toBe('true');
    expect(segmentFor('字體', '清晰黑體').attrs['aria-pressed']).toBe('false');
    segmentFor('色系', '淺色').emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ tone: 'light' });
    expect(segmentFor('色系', '淺色').attrs['aria-pressed']).toBe('true');
    expect(segmentFor('色系', '深色').attrs['aria-pressed']).toBe('false');
    // 點目前已選的項目不會重複寫入
    segmentFor('色系', '淺色').emit('click');
    expect(host.updateSettings).toHaveBeenCalledTimes(2);
  });

  it('updates the output and saves on slider input, then shows the normalized value', () => {
    const { host, rangeFor } = fixture();
    const { input, output } = rangeFor('正文字級');
    input.value = '18'; input.emit('input');
    expect(output.textContent).toBe('18px');
    expect(input.attrs['aria-valuetext']).toBe('18px');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ fontSize: 18 });
    const opacity = rangeFor('閱讀面板不透明度');
    opacity.input.value = '85'; opacity.input.emit('input');
    expect(opacity.output.textContent).toBe('85%');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ opacity: 85 });
    const gutter = rangeFor('卡片外側左右留白');
    gutter.input.value = '300'; gutter.input.emit('input');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ pageGutter: 300 });
    expect(host.settings).toMatchObject({ fontSize: 18, opacity: 85, pageGutter: 300 });
  });

  it('keeps the preview variables in step with the settings', async () => {
    const { host, preview, rangeFor, segmentFor, cardFor } = fixture();
    expect(preview.style.getPropertyValue('--kn-pv-strength')).toBe('0.7');
    expect(preview.style.getPropertyValue('--kn-pv-opacity')).toBe('0.94');
    expect(preview.style.getPropertyValue('--kn-pv-blur')).toBe('10px');
    expect(preview.style.getPropertyValue('--kn-pv-font-size')).toBe('14px');
    expect(preview.style.getPropertyValue('--kn-pv-ink')).toBe('100%');
    expect(preview.style.getPropertyValue('--kn-pv-image')).toBe('none');
    expect(preview.style.getPropertyValue('--kn-pv-font')).toContain('PingFang TC');
    expect(preview.dataset).toMatchObject({ tone: 'dark', background: 'aurora', enabled: 'true' });

    rangeFor('背景濃度').input.value = '40'; rangeFor('背景濃度').input.emit('input');
    rangeFor('閱讀面板不透明度').input.value = '85'; rangeFor('閱讀面板不透明度').input.emit('input');
    rangeFor('文字明暗').input.value = '90'; rangeFor('文字明暗').input.emit('input');
    rangeFor('正文字級').input.value = '15'; rangeFor('正文字級').input.emit('input');
    rangeFor('背景柔焦').input.value = '0'; rangeFor('背景柔焦').input.emit('input');
    segmentFor('字體', '書頁宋體').emit('click');
    segmentFor('色系', '淺色').emit('click');
    cardFor('dusk').emit('click');
    await flush();
    expect(preview.style.getPropertyValue('--kn-pv-strength')).toBe('0.4');
    expect(preview.style.getPropertyValue('--kn-pv-opacity')).toBe('0.85');
    expect(preview.style.getPropertyValue('--kn-pv-ink')).toBe('90%');
    expect(preview.style.getPropertyValue('--kn-pv-font-size')).toBe('10.5px');
    expect(preview.style.getPropertyValue('--kn-pv-blur')).toBe('0px');
    expect(preview.style.getPropertyValue('--kn-pv-font')).toContain('Songti TC');
    expect(preview.dataset).toMatchObject({ tone: 'light', background: 'dusk' });
    expect(host.settings).toMatchObject({ strength: 40, opacity: 85, inkStrength: 90, fontSize: 15, blur: 0, fontFamily: 'serif', tone: 'light', background: 'dusk' });
  });

  it('exposes pure preview mappings that stay within the card', () => {
    expect(previewFontSize(12)).toBe(9);
    expect(previewFontSize(20)).toBe(14);
    expect(previewFontSize(32)).toBe(22.4);
    expect(previewWidth(360)).toBe(40);
    expect(previewWidth(760)).toBe(59);
    expect(previewWidth(1600)).toBe(100);
    expect(previewGutter(0)).toBe(6);
    expect(previewGutter(300)).toBe(22);
    const vars = previewVariables(VAULT_SETTINGS, path => `app://x/${path}`);
    expect(vars).toMatchObject({
      '--kn-pv-ink': '90%', '--kn-pv-width': '100%', '--kn-pv-gutter': '9.5%', '--kn-pv-strength': '0.4',
      '--kn-pv-blur': '0px', '--kn-pv-opacity': '0.85', '--kn-pv-image': 'url("app://x/.obsidian/plugins/knowledge-space/assets/background-1.webp")',
    });
  });

  it('selects background presets and opens the picker from an empty image card', () => {
    const { host, cardFor, root } = fixture();
    const fileInput = root.querySelector('input[type="file"]')!;
    const picker = vi.spyOn(fileInput, 'click');
    cardFor('dusk').emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ background: 'dusk' });
    expect(cardFor('dusk').attrs['aria-pressed']).toBe('true');
    expect(cardFor('aurora').attrs['aria-pressed']).toBe('false');
    expect(cardFor('image').dataset.empty).toBe('true');
    expect(root.find('kn-image-actions')!.attrs.hidden).toBe('');
    cardFor('image').emit('click');
    expect(picker).toHaveBeenCalledTimes(1);
    expect(host.updateSettings).toHaveBeenCalledTimes(1);
    expect(fileInput.attrs.accept).toBe('image/png,image/jpeg,image/webp,image/avif');
  });

  it('reuses a stored image, replaces it through the picker and clears it back to aurora', () => {
    const { host, cardFor, root } = fixture({ ...VAULT_SETTINGS, background: 'plain' });
    cardFor('image').emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ background: 'image' });
    const picker = vi.spyOn(root.querySelector('input[type="file"]')!, 'click');
    root.findText('更換圖片', 'button')!.emit('click');
    expect(picker).toHaveBeenCalledTimes(1);
    root.findText('清除圖片', 'button')!.emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ imagePath: '', background: 'aurora' });
    expect(host.settings).toMatchObject({ imagePath: '', background: 'aurora' });
    expect(cardFor('image').find('kn-bg-card-label')!.textContent).toBe('選擇圖片');
    expect(cardFor('image').find('kn-swatch')!.style.getPropertyValue('background-image')).toBe('');
  });

  it('clearing the stored image keeps a non-image preset', () => {
    const { host, root } = fixture({ ...VAULT_SETTINGS, background: 'dusk' });
    root.findText('清除圖片', 'button')!.emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ imagePath: '' });
    expect(host.settings).toMatchObject({ imagePath: '', background: 'dusk' });
  });

  it('imports a picked image and disables the image controls while importing', async () => {
    const { host, root, cardFor, preview } = fixture();
    let settle!: () => void;
    host.importBackground.mockImplementation(() => new Promise<void>(resolve => {
      settle = () => { host.settings = { ...host.settings, background: 'image', imagePath: 'assets/new.png' }; resolve(); };
    }));
    const fileInput = root.querySelector('input[type="file"]')!;
    const file = { type: 'image/png', size: 1024 } as unknown as File;
    fileInput.files = [file];
    fileInput.emit('change');
    expect(host.importBackground).toHaveBeenCalledWith(file);
    expect(cardFor('image').disabled).toBe(true);
    expect(cardFor('image').attrs['aria-busy']).toBe('true');
    expect(fileInput.value).toBe('');
    settle(); await flush();
    expect(cardFor('image').disabled).toBe(false);
    expect(cardFor('image').attrs['aria-busy']).toBeUndefined();
    expect(cardFor('image').attrs['aria-pressed']).toBe('true');
    expect(preview.dataset.background).toBe('image');
    expect(preview.style.getPropertyValue('--kn-pv-image')).toBe('url("app://vault/assets/new.png")');
  });

  it('shows a Notice and keeps the settings when importing fails', async () => {
    const { host, root, cardFor, preview } = fixture(VAULT_SETTINGS);
    const before = { ...host.settings };
    Notice.messages = [];
    host.importBackground.mockRejectedValue(new Error('請選擇 10 MB 以內的 PNG、JPEG、WebP 或 AVIF 圖片。'));
    const fileInput = root.querySelector('input[type="file"]')!;
    fileInput.files = [{ type: 'image/gif', size: 1 }];
    fileInput.emit('change');
    await flush();
    expect(Notice.messages).toEqual(['無法設定背景：請選擇 10 MB 以內的 PNG、JPEG、WebP 或 AVIF 圖片。']);
    expect(host.updateSettings).not.toHaveBeenCalled();
    expect(host.settings).toEqual(before);
    expect(cardFor('image').disabled).toBe(false);
    expect(cardFor('image').attrs['aria-pressed']).toBe('true');
    expect(preview.style.getPropertyValue('--kn-pv-image')).toBe('url("app://vault/.obsidian/plugins/knowledge-space/assets/background-1.webp")');
    // 沒有檔案時不呼叫匯入
    fileInput.files = [];
    fileInput.emit('change');
    expect(host.importBackground).toHaveBeenCalledTimes(1);
  });

  it('toggles the master switch by click and keyboard with native classes and aria state', () => {
    const { host, root, preview } = fixture();
    const toggle = root.find('checkbox-container')!;
    const input = toggle.children[0];
    const preventDefault = vi.fn();
    toggle.emit('click', { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(host.updateSettings).toHaveBeenLastCalledWith({ enabled: false });
    expect(toggle.hasClass('is-enabled')).toBe(false);
    expect(toggle.attrs['aria-checked']).toBe('false');
    expect(input.checked).toBe(false);
    expect(root.dataset.enabled).toBe('false');
    expect(preview.find('kn-preview-badge')!.textContent).toBe('預覽（目前未套用）');
    toggle.emit('keydown', { key: ' ' });
    expect(host.updateSettings).toHaveBeenLastCalledWith({ enabled: true });
    expect(toggle.hasClass('is-enabled')).toBe(true);
    expect(input.checked).toBe(true);
    toggle.emit('keydown', { key: 'Enter' });
    expect(host.settings.enabled).toBe(false);
    toggle.emit('keydown', { key: 'a' });
    expect(host.settings.enabled).toBe(false);
    expect(host.updateSettings).toHaveBeenCalledTimes(3);
    // 點文字標籤也會切換
    root.find('kn-master-label')!.emit('click');
    expect(host.settings.enabled).toBe(true);
    expect(toggle.hasClass('is-enabled')).toBe(true);
  });

  it('resets everything except enabled and imagePath', () => {
    const { host, root, rangeFor, segmentFor } = fixture({ ...VAULT_SETTINGS, enabled: false });
    root.findText('重設外觀', 'button')!.emit('click');
    expect(host.updateSettings).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, enabled: false, imagePath: VAULT_SETTINGS.imagePath });
    expect(host.settings).toEqual({ ...DEFAULT_SETTINGS, enabled: false, imagePath: VAULT_SETTINGS.imagePath });
    expect(rangeFor('正文字級').output.textContent).toBe('20px');
    expect(rangeFor('卡片外側左右留白').output.textContent).toBe('24px');
    expect(segmentFor('字體', '清晰黑體').attrs['aria-pressed']).toBe('true');
    expect(root.find('checkbox-container')!.hasClass('is-enabled')).toBe(false);
    // 圖片仍保留，可再次使用
    expect(root.find('kn-image-actions')!.attrs.hidden).toBeUndefined();
  });

  it('closes before revealing the outline, and the done button closes', () => {
    const { host, root } = fixture();
    const order: string[] = [];
    host.close.mockImplementation(() => { order.push('close'); });
    host.revealOutline.mockImplementation(() => { order.push('reveal'); });
    root.findText('顯示目前目錄', 'button')!.emit('click');
    expect(order).toEqual(['close', 'reveal']);
    root.findText('完成', 'button')!.emit('click');
    expect(host.close).toHaveBeenCalledTimes(2);
  });

  it('leaves no listeners behind after destroy and ignores late events', async () => {
    const { document, container, host, panel, root, rangeFor } = fixture();
    const slider = rangeFor('正文字級').input;
    const toggle = root.find('checkbox-container')!;
    expect(container.deepListenerCount()).toBeGreaterThan(0);
    panel.destroy();
    expect(document.listenerCount()).toBe(0);
    expect(document.body.deepListenerCount()).toBe(0);
    expect(root.deepListenerCount()).toBe(0);
    expect(container.children).toEqual([]);
    slider.value = '30'; slider.emit('input');
    toggle.emit('click');
    panel.sync();
    await flush();
    expect(host.updateSettings).not.toHaveBeenCalled();
    panel.destroy();
  });
});

describe('appearance panel with the plugin-style host', () => {
  beforeEach(() => { Notice.messages = []; });

  it('reads settings through a live getter so replaced settings objects are reflected', () => {
    let current = normalizeSettings(VAULT_SETTINGS);
    const document = new TestDocument();
    const host: AppearanceHost = {
      get settings() { return current; },
      updateSettings: patch => { current = normalizeSettings({ ...current, ...patch }); return Promise.resolve(); },
      importBackground: () => Promise.resolve(),
      revealOutline: () => undefined,
      resourcePath: path => path,
      close: () => undefined,
    };
    const panel = renderAppearancePanel(document.body as unknown as HTMLElement, host);
    const root = panel.rootEl as unknown as TestElement;
    const slider = root.querySelectorAll('input[type="range"]').find(el => el.attrs['aria-label'] === '正文字級')!;
    slider.value = '99'; slider.emit('input');
    // 宿主夾限到 32px，面板立刻顯示夾限後的值
    expect(current.fontSize).toBe(32);
    expect(slider.value).toBe('32');
    expect(slider.parent!.querySelector('output')!.textContent).toBe('32px');
    panel.destroy();
  });
});

describe('background image URL stability', () => {
  it('resolves the image URL once per path even when the host returns a new cache token each call', () => {
    let calls = 0;
    const { host, cardFor, preview, rangeFor } = fixture(VAULT_SETTINGS);
    host.resourcePath.mockImplementation((path: string) => `app://vault/${path}?${++calls}`);
    // 面板建立時已以原本的 mock 解析過一次；之後的重繪不得再呼叫宿主。
    const swatch = cardFor('image').find('kn-swatch')!;
    const before = swatch.style.getPropertyValue('background-image');
    expect(before).toBe('url("app://vault/.obsidian/plugins/knowledge-space/assets/background-1.webp")');
    const slider = rangeFor('背景濃度').input;
    for (const value of ['41', '42', '43']) { slider.value = value; slider.emit('input'); }
    cardFor('dusk').emit('click');
    cardFor('image').emit('click');
    expect(calls).toBe(0);
    expect(swatch.style.getPropertyValue('background-image')).toBe(before);
    expect(preview.style.getPropertyValue('--kn-pv-image')).toBe(before);
    // 換成另一張圖片（新路徑）才重新解析
    host.settings = { ...host.settings, imagePath: 'assets/background-2.webp' };
    rangeFor('背景濃度').input.emit('input');
    expect(calls).toBe(1);
    expect(swatch.style.getPropertyValue('background-image')).toBe('url("app://vault/assets/background-2.webp?1")');
    expect(preview.style.getPropertyValue('--kn-pv-image')).toBe('url("app://vault/assets/background-2.webp?1")');
    // 相同路徑再回來也只解析一次
    host.settings = { ...host.settings, imagePath: 'assets/background-2.webp' };
    rangeFor('背景濃度').input.emit('input');
    expect(calls).toBe(1);
  });

  it('moves the preview column with the content width slider', () => {
    const { preview, rangeFor } = fixture({ contentWidth: 1600 });
    expect(preview.style.getPropertyValue('--kn-pv-width')).toBe('100%');
    const slider = rangeFor('正文寬度上限').input;
    slider.value = '360'; slider.emit('input');
    expect(preview.style.getPropertyValue('--kn-pv-width')).toBe('40%');
    expect(rangeFor('正文寬度上限').output.textContent).toBe('360px');
  });
});
