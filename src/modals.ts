import { Modal, Notice, Setting } from 'obsidian';
import type KnowledgeSpacePlugin from './main';
import { DEFAULT_SETTINGS } from './settings';

export class AppearanceModal extends Modal {
  constructor(private readonly plugin: KnowledgeSpacePlugin) { super(plugin.app); }
  onOpen(): void { this.modalEl.addClass('kn-appearance-modal'); this.draw(); }
  private draw(): void {
    const { contentEl, plugin } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '筆記外觀' });
    contentEl.createEl('p', { cls: 'kn-modal-help', text: '所有筆記的閱讀模式與即時預覽都會套用，設定會自動儲存。' });
    new Setting(contentEl).setName('套用到所有筆記').addToggle(toggle => toggle.setValue(plugin.settings.enabled).onChange(value => { void plugin.updateSettings({ enabled: value }); }));
    const cards = contentEl.createDiv('kn-background-options');
    for (const [preset, label] of [['aurora', '極光'], ['dusk', '暮色'], ['plain', '純色']] as const) {
      const button = cards.createEl('button', { cls: 'kn-background-card', attr: { 'aria-pressed': String(plugin.settings.background === preset) } });
      button.dataset.selected = String(plugin.settings.background === preset);
      button.createSpan({ cls: 'kn-swatch', attr: { 'data-preset': preset } });
      button.createSpan({ text: label });
      button.onclick = () => { void plugin.updateSettings({ background: preset }); this.draw(); };
    }
    new Setting(contentEl).setName('本機圖片背景').setDesc(plugin.settings.imagePath ? '已儲存一份圖片副本，可重新使用。' : '圖片儲存在外掛資料夾，本外掛不會上傳；Vault 同步工具可能同步此資料夾。').addButton(button => button.setButtonText('選擇圖片').onClick(() => {
      const input = contentEl.createEl('input', { type: 'file', attr: { accept: 'image/png,image/jpeg,image/webp,image/avif', hidden: '' } });
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) { input.remove(); return; }
        button.setDisabled(true);
        try { await plugin.importBackground(file); if (this.modalEl.isConnected) this.draw(); }
        catch (error) { new Notice(`無法設定背景：${error instanceof Error ? error.message : String(error)}`); }
        finally { input.remove(); button.setDisabled(false); }
      };
      input.click();
    }));
    if (plugin.settings.imagePath) {
      new Setting(contentEl).setName('已儲存的圖片').addButton(button => button.setButtonText('使用圖片').onClick(() => { void plugin.updateSettings({ background: 'image' }); this.draw(); })).addButton(button => button.setButtonText('清除選擇').onClick(() => { void plugin.updateSettings({ imagePath: '', background: 'aurora' }); this.draw(); }));
    }
    new Setting(contentEl).setName('色系').addDropdown(drop => drop.addOptions({ system: '跟隨 Obsidian', dark: '深色', light: '淺色' }).setValue(plugin.settings.tone).onChange(value => { void plugin.updateSettings({ tone: value as 'system' | 'dark' | 'light' }); }));
    new Setting(contentEl).setName('字體').setDesc('微軟正黑體使用裝置上可用的字型；若未安裝，會使用系統黑體。外掛不附帶商用字型檔案。').addDropdown(drop => drop.addOptions({ sans: '清晰黑體', serif: '書頁宋體', jhenghei: '微軟正黑體' }).setValue(plugin.settings.fontFamily).onChange(value => { void plugin.updateSettings({ fontFamily: value as 'sans' | 'serif' | 'jhenghei' }); }));
    for (const [key, label, min, max, suffix] of [
      ['fontSize', '正文字級', 12, 32, 'px'], ['inkStrength', '文字明暗（越低越柔和）', 35, 100, '%'],
      ['contentWidth', '正文寬度上限', 360, 1600, 'px'], ['pageGutter', '卡片外側左右留白', 0, 300, 'px'],
      ['strength', '背景濃度', 0, 100, '%'],
      ['blur', '背景柔焦', 0, 40, 'px'], ['opacity', '閱讀面板不透明度', 0, 100, '%'],
    ] as const) {
      const setting = new Setting(contentEl).setName(`${label} · ${plugin.settings[key]}${suffix}`);
      if (key === 'opacity') setting.setDesc('0% 完全透明，100% 完全不透明；不改變文字透明度。');
      if (key === 'contentWidth') setting.setDesc('限制正文的行寬；卡片外側露出的背景由下一項控制。');
      if (key === 'pageGutter') setting.setDesc('0px 鋪滿閱讀區；數值越大，左右露出的背景越多，每側最多 300px。窄頁會自動縮減，避免正文被擠出。');
      setting.addSlider(slider => {
        slider.setLimits(min, max, 1).setValue(plugin.settings[key]).setDynamicTooltip();
        // Older Obsidian versions keep their native change-on-release behavior.
        if (key === 'pageGutter') slider.setInstant?.(true);
        slider.onChange(value => {
          setting.setName(`${label} · ${value}${suffix}`); void plugin.updateSettings({ [key]: value });
        });
      });
    }
    new Setting(contentEl).setName('本篇目錄').setDesc('按筆記左上角「前進箭頭」旁的目錄圖示展開或收合。寬頁目錄在左側，窄頁從左上角展開。').addButton(button => button.setButtonText('顯示目前目錄').onClick(() => { this.close(); plugin.revealOutline(); }));
    const actions = contentEl.createDiv('kn-modal-actions');
    actions.createEl('button', { text: '重設外觀' }).onclick = () => { void plugin.updateSettings({ ...DEFAULT_SETTINGS, enabled: plugin.settings.enabled, imagePath: plugin.settings.imagePath }); this.draw(); };
    actions.createEl('button', { text: '完成', cls: 'mod-cta' }).onclick = () => this.close();
  }
  onClose(): void { this.contentEl.empty(); }
}
