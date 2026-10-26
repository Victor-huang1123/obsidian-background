import { Modal } from 'obsidian';
import type KnowledgeSpacePlugin from './main';
import { renderAppearancePanel, type AppearancePanel } from './appearance-panel';

/** 只負責開啟 Modal 並掛上面板；控制項與互動都在 appearance-panel.ts。 */
export class AppearanceModal extends Modal {
  private panel: AppearancePanel | null = null;

  constructor(private readonly plugin: KnowledgeSpacePlugin, private readonly onClosed?: () => void) { super(plugin.app); }

  onOpen(): void {
    const { plugin } = this;
    this.modalEl.addClass('kn-appearance-modal');
    this.titleEl.setText('筆記外觀');
    this.contentEl.empty();
    this.panel = renderAppearancePanel(this.contentEl, {
      get settings() { return plugin.settings; },
      updateSettings: patch => plugin.updateSettings(patch),
      importBackground: file => plugin.importBackground(file),
      revealOutline: () => plugin.revealOutline(),
      resourcePath: path => plugin.resourcePath(path),
      close: () => this.close(),
    });
  }

  onClose(): void {
    this.panel?.destroy();
    this.panel = null;
    this.contentEl.empty();
    this.onClosed?.();
  }
}
