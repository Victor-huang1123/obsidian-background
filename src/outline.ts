import { Component, MarkdownView } from 'obsidian';
import { currentSection, headingLabel, outlineEntries, type OutlineEntry } from './outline-model';

/** Owns only a sibling navigation rail; native Markdown/CodeMirror DOM stays intact. */
export class NativeOutline extends Component {
  readonly createdDocument: Document;
  private readonly host: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly items: HTMLElement;
  private readonly toggle: HTMLElement;
  private wideViewport: boolean | null = null;
  private isOpen = false;
  private entries: OutlineEntry[] = [];
  private buttons: HTMLButtonElement[] = [];
  private signature = '';
  private activeIndex = -1;
  private frame = 0;
  private navigationFrame = 0;
  private navigationToken = 0;
  private navigationPending = false;
  private navigationObserver: MutationObserver | null = null;
  private navigationTimeout = 0;
  private selectedLanding: { index: number; line: number } | null = null;
  private readonly win: Window;

  constructor(readonly view: MarkdownView) {
    super();
    this.host = view.contentEl;
    this.createdDocument = this.host.ownerDocument;
    this.win = this.host.ownerDocument.defaultView!;
    this.host.addClass('kn-with-outline');
    this.panel = this.host.createEl('aside', { cls: 'kn-native-outline', attr: { 'aria-label': '本篇目錄' } });
    const header = this.panel.createEl('header');
    header.createEl('small', { text: '本篇目錄' });
    this.title = header.createDiv('kn-outline-title');
    this.items = this.panel.createEl('nav', { cls: 'kn-outline-items', attr: { 'aria-label': '筆記章節' } });
    this.toggle = this.view.addAction('list-tree', '本篇目錄', () => {});
    this.toggle.addClass('kn-outline-toggle');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-label', '本篇目錄');
    this.toggle.setAttribute('role', 'button');
    this.toggle.setAttribute('tabindex', '0');
    // Move only our own action. Keep the native fallback on phones or themes
    // that omit the history controls.
    if (!this.createdDocument.body.classList.contains('is-phone')) {
      this.view.containerEl.querySelector('.view-header-nav-buttons')?.appendChild(this.toggle);
    }
  }

  onload(): void {
    this.registerDomEvent(this.toggle, 'click', () => this.setOpen(!this.isOpen));
    this.registerDomEvent(this.toggle, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.setOpen(!this.isOpen); }
    });
    this.registerDomEvent(this.items, 'click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
      if (!button) return;
      const index = Number(button.dataset.index);
      const entry = this.entries[index];
      if (!entry) return;
      if (!this.wideViewport) this.setOpen(false);
      this.navigate(index, entry);
    });
    this.registerDomEvent(this.host, 'scroll', event => {
      if (this.panel.contains(event.target as Node)) return;
      this.scheduleActive();
    }, { capture: true, passive: true });
    this.registerDomEvent(this.host, 'wheel', event => {
      if (!this.panel.contains(event.target as Node)) this.cancelNavigation();
    }, { passive: true });
    this.registerDomEvent(this.host, 'touchstart', event => {
      if (!this.panel.contains(event.target as Node)) this.cancelNavigation();
    }, { passive: true });
    this.registerDomEvent(this.host.ownerDocument, 'keydown', event => {
      if (event.key === 'Escape' && this.host.hasClass('kn-outline-open')) { this.setOpen(false); this.toggle.focus(); }
    });
    this.registerDomEvent(this.host.ownerDocument, 'pointerdown', event => {
      if (!this.wideViewport && !this.panel.contains(event.target as Node) && !this.toggle.contains(event.target as Node)) this.setOpen(false);
    });
    const resize = new ResizeObserver(() => {
      // Use the border-box: adding the rail changes content-box width.
      const wide = this.host.getBoundingClientRect().width >= 1000;
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
      this.panel.remove(); this.toggle.remove();
      this.host.removeClass('kn-with-outline', 'kn-outline-wide', 'kn-outline-open');
    });
    this.refresh();
  }

  refresh(): void {
    const file = this.view.file;
    const entries = file ? outlineEntries(this.view.app.metadataCache.getFileCache(file)?.headings ?? [], file.basename) : [];
    const signature = JSON.stringify([file?.path, entries]);
    if (signature !== this.signature) {
      this.cancelNavigation();
      this.signature = signature;
      this.entries = entries;
      this.activeIndex = -1;
      this.title.setText(file?.basename ?? '筆記');
      this.title.title = file?.basename ?? '';
      this.items.empty();
      this.buttons = entries.map((entry, index) => {
        const button = this.items.createEl('button', { cls: 'kn-outline-link', attr: { 'data-index': String(index), title: entry.label } });
        button.style.setProperty('--kn-outline-depth', String(Math.min(entry.depth, 4)));
        button.createSpan({ cls: 'kn-outline-number', text: String(index + 1).padStart(2, '0') });
        button.createSpan({ cls: 'kn-outline-label', text: entry.label });
        return button;
      });
      if (!entries.length) this.items.createEl('p', { cls: 'kn-outline-empty', text: '這篇筆記還沒有章節標題。' });
    }
    this.scheduleActive();
  }

  get isMounted(): boolean {
    return this.host === this.view.contentEl && this.panel.parentElement === this.host && this.toggle.isConnected;
  }

  reveal(): void {
    this.setOpen(true);
    (this.buttons[Math.max(0, this.activeIndex)] ?? this.toggle).focus();
  }

  private setOpen(open: boolean): void {
    this.isOpen = open;
    const docked = !!this.wideViewport && open;
    if (this.host.hasClass('kn-outline-wide') !== docked) this.host.toggleClass('kn-outline-wide', docked);
    if (this.host.hasClass('kn-outline-open') !== open) this.host.toggleClass('kn-outline-open', open);
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.setAttribute('aria-label', open ? '收合本篇目錄' : '開啟本篇目錄');
  }

  private scheduleActive(): void {
    if (this.frame) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      if (this.navigationPending) return;
      const line = this.view.currentMode.getScroll();
      if (typeof line !== 'number' || !Number.isFinite(line)) return;
      // A final section cannot always reach the top: retain the clicked
      // section at its landing position until the reader actually scrolls.
      if (this.selectedLanding && Math.abs(line - this.selectedLanding.line) < 0.01) {
        this.setActive(this.selectedLanding.index); return;
      }
      this.selectedLanding = null;
      this.setActive(currentSection(this.entries, line));
    });
  }

  private cancelNavigation(): void {
    this.navigationToken++;
    if (this.navigationFrame) this.win.cancelAnimationFrame(this.navigationFrame);
    this.navigationFrame = 0;
    this.navigationPending = false;
    this.navigationObserver?.disconnect();
    this.navigationObserver = null;
    if (this.navigationTimeout) this.win.clearTimeout(this.navigationTimeout);
    this.navigationTimeout = 0;
    if (this.host.hasClass('kn-outline-jump')) {
      this.host.querySelectorAll(':scope > .markdown-reading-view > .markdown-preview-view .is-flashing')
        .forEach(el => el.classList.remove('is-flashing'));
      this.host.removeClass('kn-outline-jump');
    }
    this.selectedLanding = null;
  }

  private navigate(index: number, entry: OutlineEntry): void {
    this.cancelNavigation();
    const token = this.navigationToken;
    const mode = this.view.getMode();
    const lastLine = mode === 'source' ? this.view.editor.lastLine() : this.view.getViewData().split('\n').length - 1;
    const line = Math.max(0, Math.min(entry.line, lastLine));
    this.navigationPending = true;
    this.setActive(index);
    const finish = (): void => {
      this.navigationFrame = this.win.requestAnimationFrame(() => {
        if (token !== this.navigationToken) return;
        this.navigationFrame = 0;
        if (this.view.getMode() !== mode) { this.cancelNavigation(); this.scheduleActive(); return; }
        this.navigationPending = false;
        this.selectedLanding = { index, line: this.view.currentMode.getScroll() };
        this.setActive(index);
      });
    };
    const scroller = mode === 'preview'
      ? this.host.querySelector<HTMLElement>(':scope > .markdown-reading-view > .markdown-preview-view')
      : null;
    if (!scroller) {
      // Scroll-only keeps the editor cursor and selection intact.
      this.view.leaf.setEphemeralState({ scroll: line });
      finish(); return;
    }

    // Native line navigation also unfolds hidden sections. Its temporary
    // marker identifies the exact rendered section, including repeated titles.
    // Observe that marker because a virtualized preview may render later.
    scroller.querySelectorAll('.is-flashing').forEach(el => el.classList.remove('is-flashing'));
    this.host.addClass('kn-outline-jump');
    const align = (): void => {
      this.navigationFrame = 0;
      if (token !== this.navigationToken) return;
      if (this.view.getMode() !== mode) { this.cancelNavigation(); this.scheduleActive(); return; }
      const section = scroller.querySelector<HTMLElement>('.is-flashing');
      if (!section) return;
      const candidates = section.matches('h1,h2,h3,h4,h5,h6') ? [section]
        : [...section.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')];
      const heading = candidates.find(el => !el.closest('.markdown-embed, .internal-embed')
        && headingLabel(el.textContent ?? '') === entry.label);
      // Compound Markdown sections can contain multiple headings. A missing
      // label keeps native positioning rather than aligning an unrelated one.
      if (heading) {
        const offset = heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24;
        scroller.scrollTop = Math.max(0, scroller.scrollTop + offset);
      }
      section.classList.remove('is-flashing');
      this.navigationObserver?.disconnect();
      this.navigationObserver = null;
      this.win.clearTimeout(this.navigationTimeout);
      this.navigationTimeout = 0;
      this.host.removeClass('kn-outline-jump');
      finish();
    };
    const queueAlign = (): void => {
      if (token === this.navigationToken && !this.navigationFrame) this.navigationFrame = this.win.requestAnimationFrame(align);
    };
    this.navigationObserver = new MutationObserver(queueAlign);
    this.navigationObserver.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    this.navigationTimeout = this.win.setTimeout(() => {
      if (token !== this.navigationToken) return;
      // Unsupported themes/renderers retain native line navigation, without
      // leaving observers or a permanently pinned chapter behind.
      this.cancelNavigation(); this.scheduleActive();
    }, 2000);
    this.view.leaf.setEphemeralState({ line, focus: false });
    queueAlign();
  }

  private setActive(index: number): void {
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    this.buttons.forEach((button, i) => {
      button.toggleClass('is-active', index === i);
      if (index === i) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
  }
}
