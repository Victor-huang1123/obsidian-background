import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeadingCache, MarkdownView } from 'obsidian';
import { TestDocument, TestElement, TestMutationObserver, TestResizeObserver } from './mocks/outline-dom';

vi.mock('obsidian', async () => {
  const { TestComponent } = await import('./mocks/outline-dom');
  return { Component: TestComponent, MarkdownView: class {}, setIcon: vi.fn() };
});
import { NativeOutline } from '../src/outline';

const heading = (text: string, line: number): HeadingCache => ({
  heading: text, level: 2,
  position: { start: { line, col: 0, offset: 0 }, end: { line, col: text.length, offset: text.length } },
});

function fixture(path = 'Note.md', options: { phone?: boolean; document?: TestDocument; navigation?: boolean } = {}) {
  const document = options.document ?? new TestDocument();
  if (options.phone) document.body.addClass('is-phone');
  const container = document.body.createDiv('workspace-leaf-content');
  const header = container.createDiv('view-header');
  const navigation = options.navigation === false ? null : header.createDiv('view-header-nav-buttons');
  const back = navigation?.createDiv('native-back');
  const forward = navigation?.createDiv('native-forward');
  const toolbar = header.createDiv('view-actions');
  const nativeAction = toolbar.createDiv('native-action');
  const host = container.createDiv('view-content');
  const native = host.createDiv('markdown-reading-view');
  const scroller = native.createDiv('markdown-preview-view');
  const source = host.createDiv('markdown-source-view mod-cm6');
  const sourceScroller = source.createDiv('cm-editor').createDiv('cm-scroller');
  const jump = vi.fn();
  const getScroll = vi.fn(() => 0);
  const view = {
    containerEl: container, contentEl: host, addAction: () => toolbar.createDiv('clickable-icon'), file: { path, basename: path.slice(0, -3) },
    leaf: { setEphemeralState: jump }, currentMode: { getScroll },
    getViewData: () => Array.from({length: 25}, (_, line) => line === 2 ? '## Intro' : line === 20 ? '## Core' : '').join('\n'),
    getMode: () => 'preview', editor: { lastLine: () => 100 },
    app: { metadataCache: { getFileCache: () => ({ headings: [heading('Intro', 2), heading('Core', 20)] }) } },
  } as unknown as MarkdownView;
  const controller = new NativeOutline(view);
  controller.load();
  const nav = host.find('kn-outline-items')!;
  const toggle = header.find('kn-outline-toggle')!;
  return { document, container, navigation, back, forward, host, toolbar, nativeAction, native, source, scroller, sourceScroller, jump, getScroll, view, controller, nav, toggle };
}

function renderTarget(scroller: TestElement, top: number, directHeading = false, label = 'Core'): TestElement {
  const section = scroller.createEl(directHeading ? 'h2' : 'div', { cls: 'is-flashing' });
  const target = directHeading ? section : section.createEl('h2');
  target.setText(label);
  target.top = top;
  TestMutationObserver.instances.at(-1)?.deliver();
  return section;
}

describe('native outline controller', () => {
  beforeEach(() => {
    TestResizeObserver.instances = []; TestMutationObserver.instances = [];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('MutationObserver', TestMutationObserver);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('navigates the owning note when another outline also exists, without modifying native content', () => {
    const first = fixture('First.md');
    const second = fixture('Second.md', { document: first.document });
    const untouchedMarker = second.scroller.createDiv('is-flashing');
    first.toggle.emit('click');
    const label = first.nav.children[1].children[1];
    first.nav.emit('click', { target: label });
    const destination = first.jump.mock.calls[0][0];
    expect(destination).toEqual({ line: 20, focus: false });
    expect(destination).not.toHaveProperty('match');
    expect(second.jump).not.toHaveBeenCalled();
    expect(first.host.hasClass('kn-outline-open')).toBe(false);
    expect(first.host.children).toContain(first.native);
    expect(first.native.children).toEqual([first.scroller]);
    expect(second.toggle.parentElement).toBe(second.navigation);
    expect(untouchedMarker.hasClass('is-flashing')).toBe(true);
    first.controller.unload(); second.controller.unload();
  });

  it('coalesces scroll events into one frame and refreshes section highlighting from the native view', () => {
    const { document, host, scroller, getScroll, controller, nav } = fixture();
    document.flushFrame(); getScroll.mockClear(); getScroll.mockReturnValue(21.5);
    for (let i = 0; i < 25; i++) host.emit('scroll', { target: scroller });
    expect(document.frames.size).toBe(1);
    document.flushFrame();
    expect(getScroll).toHaveBeenCalledTimes(1);
    expect(nav.children[1].attrs['aria-current']).toBe('location');
    expect(nav.children[0].attrs['aria-current']).toBeUndefined();
    expect(document.frames.size).toBe(0);
    controller.unload();
  });

  it('clamps stale cached headings after a native editor deletion', () => {
    const { view, nav, jump, controller } = fixture();
    vi.spyOn(view, 'getMode').mockReturnValue('source');
    vi.spyOn(view.editor, 'lastLine').mockReturnValue(3);
    nav.emit('click', { target: nav.children[1] });
    expect(jump).toHaveBeenCalledWith({ scroll: 3 });
    controller.unload();
  });

  it('changes wide/narrow layout only at the border-box threshold without repeated class writes', () => {
    const { document, host, controller, toggle } = fixture();
    const observer = TestResizeObserver.instances[0];
    const toggleClass = vi.spyOn(host, 'toggleClass');
    host.width = 1200; observer.deliver();
    expect(host.hasClass('kn-outline-wide')).toBe(true);
    toggleClass.mockClear();
    for (let i = 0; i < 20; i++) observer.deliver();
    expect(toggleClass).not.toHaveBeenCalled();
    expect(document.frames.size).toBe(1);
    host.width = 700; observer.deliver(); toggle.emit('click');
    expect(host.hasClass('kn-outline-wide')).toBe(false);
    expect(host.hasClass('kn-outline-open')).toBe(true);
    host.width = 1200; observer.deliver();
    expect(host.hasClass('kn-outline-open')).toBe(true);
    toggle.emit('click');
    expect(host.hasClass('kn-outline-wide')).toBe(false);
    observer.deliver();
    expect(host.hasClass('kn-outline-open')).toBe(false);
    controller.unload();
  });

  it('reports a detached navigation panel so the plugin can remount it', () => {
    const { host, controller } = fixture();
    expect(controller.isMounted).toBe(true);
    host.find('kn-native-outline')!.remove();
    expect(controller.isMounted).toBe(false);
    controller.unload();
  });

  it('unloads only its own navigation, cancels queued work, and detaches document and host listeners', () => {
    const { document, host, toolbar, navigation, back, forward, nativeAction, native, source, controller, nav, toggle, jump } = fixture();
    const observer = TestResizeObserver.instances[0];
    const staleButton = nav.children[0];
    expect(document.frames.size).toBe(1);
    controller.unload();
    expect(host.children).toEqual([native, source]);
    expect(toolbar.children).toEqual([nativeAction]);
    expect(navigation!.children).toEqual([back, forward]);
    expect([...host.classes]).toEqual(['view-content']);
    expect(document.listenerCount()).toBe(0);
    expect(host.listenerCount()).toBe(0);
    expect(nav.listenerCount()).toBe(0);
    expect(toggle.listenerCount()).toBe(0);
    expect(document.frames.size).toBe(0);
    expect(observer.disconnected).toBe(true);
    nav.emit('click', { target: staleButton }); host.emit('scroll'); observer.deliver();
    expect(jump).not.toHaveBeenCalled();
    expect(document.frames.size).toBe(0);
  });

  it('places its native action immediately after the forward button without moving other controls', () => {
    const { navigation, back, forward, toggle, toolbar, nativeAction, controller } = fixture();
    expect(navigation!.children).toEqual([back, forward, toggle]);
    expect(toolbar.children).toEqual([nativeAction]);
    expect(toggle.hasClass('clickable-icon')).toBe(true);
    toggle.emit('click');
    expect(toggle.attrs['aria-expanded']).toBe('true');
    controller.unload();
  });

  it.each([{ phone: true }, { navigation: false }])('retains the native action fallback when history controls are unavailable: %j', options => {
    const { navigation, back, forward, toolbar, nativeAction, toggle, controller } = fixture('Note.md', options);
    expect(toolbar.children).toEqual([nativeAction, toggle]);
    if (navigation) expect(navigation.children).toEqual([back, forward]);
    controller.unload();
  });

  it('keeps the clicked section active after native preview navigation leaves space above the heading', () => {
    const { document, host, scroller, getScroll, nav, controller } = fixture();
    document.flushFrame();
    nav.emit('click', { target: nav.children[1] });
    // Native navigation settles asynchronously; a stale scroll frame must not
    // immediately move the active item back to the preceding section.
    host.emit('scroll', { target: scroller }); document.flushFrame();
    expect(nav.children[1].attrs['aria-current']).toBe('location');
    expect(host.hasClass('kn-outline-jump')).toBe(true);
    getScroll.mockReturnValue(20); scroller.scrollTop = 500;
    const section = renderTarget(scroller, 100);
    document.flushFrame();
    expect(scroller.scrollTop).toBe(476);
    expect(section.hasClass('is-flashing')).toBe(false);
    expect(host.hasClass('kn-outline-jump')).toBe(false);
    expect(document.timers.size).toBe(0);
    getScroll.mockReturnValue(19.4); document.flushFrame();
    host.emit('scroll', { target: scroller }); document.flushFrame();
    expect(nav.children[1].attrs['aria-current']).toBe('location');
    expect(nav.children[0].attrs['aria-current']).toBeUndefined();
    // A real subsequent scroll releases the landing selection.
    getScroll.mockReturnValue(10); scroller.scrollTop = 250;
    host.emit('scroll', { target: scroller }); document.flushFrame();
    expect(nav.children[0].attrs['aria-current']).toBe('location');
    expect(nav.children[1].attrs['aria-current']).toBeUndefined();
    controller.unload();
  });

  it('settles a final section clamped at the document bottom and preserves its selected index', () => {
    const { document, host, scroller, getScroll, nav, controller } = fixture();
    document.flushFrame(); nav.emit('click', { target: nav.children[1] });
    getScroll.mockReturnValue(12); scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    renderTarget(scroller, 640, true);
    document.flushFrame();
    expect(scroller.scrollTop).toBe(1400);
    getScroll.mockReturnValue(11.4); document.flushFrame();
    expect(document.frames.size).toBe(0);
    host.emit('scroll', { target: scroller }); document.flushFrame();
    expect(nav.children[1].attrs['aria-current']).toBe('location');
    getScroll.mockReturnValue(10.8); scroller.scrollTop -= 30;
    host.emit('scroll', { target: scroller }); document.flushFrame();
    expect(nav.children[0].attrs['aria-current']).toBe('location');
    controller.unload();
  });

  it('ignores scrolling inside the navigation panel', () => {
    const { document, host, getScroll, nav, controller } = fixture();
    document.flushFrame(); getScroll.mockClear(); getScroll.mockReturnValue(22);
    host.emit('scroll', { target: nav });
    host.emit('scroll', { target: nav.children[1] });
    expect(document.frames.size).toBe(0);
    expect(getScroll).not.toHaveBeenCalled();
    expect(nav.children[0].attrs['aria-current']).toBe('location');
    controller.unload();
  });

  it('cancels the first destination when two sections are clicked before navigation settles', () => {
    const { document, scroller, getScroll, nav, jump, controller } = fixture();
    document.flushFrame();
    nav.emit('click', { target: nav.children[1] });
    const oldSection = renderTarget(scroller, 500);
    const oldObserver = TestMutationObserver.instances.at(-1)!;
    nav.emit('click', { target: nav.children[0] });
    expect(jump.mock.calls).toEqual([[{ line: 20, focus: false }], [{ line: 2, focus: false }]]);
    expect(oldSection.hasClass('is-flashing')).toBe(false);
    expect(oldObserver.disconnected).toBe(true);
    getScroll.mockReturnValue(2); scroller.scrollTop = 100;
    renderTarget(scroller, 100, false, 'Intro');
    oldObserver.deliver();
    document.flushFrame();
    expect(scroller.scrollTop).toBe(76);
    getScroll.mockReturnValue(1.4); document.flushFrame();
    expect(nav.children[0].attrs['aria-current']).toBe('location');
    expect(nav.children[1].attrs['aria-current']).toBeUndefined();
    expect(document.frames.size).toBe(0);
    controller.unload();
  });

  it('cancels pending navigation on unload before it can change the native scroller', () => {
    const { document, scroller, getScroll, nav, controller } = fixture();
    document.flushFrame();
    nav.emit('click', { target: nav.children[1] });
    expect(document.frames.size).toBeGreaterThan(0);
    const observer = TestMutationObserver.instances.at(-1)!;
    scroller.scrollTop = 500; getScroll.mockReturnValue(20);
    controller.unload(); document.flushFrame();
    observer.deliver(); document.flushTimers();
    expect(observer.disconnected).toBe(true);
    expect(document.frames.size).toBe(0);
    expect(document.timers.size).toBe(0);
    expect(scroller.scrollTop).toBe(500);
  });

  it('uses the native source-view scroll destination without modifying preview or editor pixels', () => {
    const { document, view, scroller, sourceScroller, getScroll, nav, jump, controller } = fixture();
    vi.spyOn(view, 'getMode').mockReturnValue('source');
    document.flushFrame();
    scroller.scrollTop = 123; sourceScroller.scrollTop = 500;
    nav.emit('click', { target: nav.children[1] });
    getScroll.mockReturnValue(20); document.flushFrame(); document.flushFrame();
    expect(jump).toHaveBeenCalledWith({ scroll: 20 });
    expect(scroller.scrollTop).toBe(123);
    expect(sourceScroller.scrollTop).toBe(500);
    expect(nav.children[1].attrs['aria-current']).toBe('location');
    controller.unload();
  });

  it('clamps preview headings using current Markdown text rather than a stale editor instance', () => {
    const { view, nav, jump, controller } = fixture();
    vi.spyOn(view.editor, 'lastLine').mockReturnValue(0);
    vi.spyOn(view, 'getViewData').mockReturnValue('## Intro\nbody\n## Core');
    nav.emit('click', { target: nav.children[1] });
    expect(jump).toHaveBeenCalledWith({ line: 2, focus: false });
    controller.unload();
  });

  it('waits for a virtualized preview marker without polling and clears pending state after timeout', () => {
    const { document, host, scroller, getScroll, nav, controller } = fixture();
    document.flushFrame(); nav.emit('click', { target: nav.children[1] });
    document.flushFrame();
    expect(document.frames.size).toBe(0);
    expect(document.timers.size).toBe(1);
    const observer = TestMutationObserver.instances.at(-1)!;
    getScroll.mockReturnValue(5); document.flushTimers(); document.flushFrame();
    expect(observer.disconnected).toBe(true);
    expect(host.hasClass('kn-outline-jump')).toBe(false);
    expect(nav.children[0].attrs['aria-current']).toBe('location');
    expect(document.timers.size).toBe(0);
    expect(scroller.scrollTop).toBe(0);
    controller.unload();
  });

  it('aligns the matching heading in a compound section and ignores matching embedded-note headings', () => {
    const { document, scroller, nav, controller } = fixture();
    document.flushFrame(); nav.emit('click', { target: nav.children[1] });
    scroller.scrollTop = 300;
    const section = scroller.createDiv('is-flashing');
    section.createEl('h2', { text: 'Unrelated' }).top = 900;
    section.createDiv('markdown-embed').createEl('h2', { text: 'Core' }).top = 700;
    section.createEl('h2', { text: '**Core**' }).top = 160;
    TestMutationObserver.instances.at(-1)!.deliver(); document.flushFrame();
    expect(scroller.scrollTop).toBe(336);
    expect(section.hasClass('is-flashing')).toBe(false);
    document.flushFrame(); controller.unload();
  });

  it('keeps native positioning when a rendered marker contains no matching note heading', () => {
    const { document, host, scroller, nav, controller } = fixture();
    document.flushFrame(); nav.emit('click', { target: nav.children[1] });
    scroller.scrollTop = 300;
    const section = renderTarget(scroller, 800, false, 'Another section');
    document.flushFrame(); document.flushFrame();
    expect(scroller.scrollTop).toBe(300);
    expect(section.hasClass('is-flashing')).toBe(false);
    expect(host.hasClass('kn-outline-jump')).toBe(false);
    expect(document.timers.size).toBe(0);
    controller.unload();
  });

  it('cleans up pending preview navigation when the note switches to editing mode', () => {
    const { document, view, host, scroller, nav, controller } = fixture();
    document.flushFrame(); nav.emit('click', { target: nav.children[1] });
    scroller.scrollTop = 300;
    const section = renderTarget(scroller, 800);
    vi.spyOn(view, 'getMode').mockReturnValue('source');
    document.flushFrame(); document.flushFrame();
    expect(scroller.scrollTop).toBe(300);
    expect(section.hasClass('is-flashing')).toBe(false);
    expect(host.hasClass('kn-outline-jump')).toBe(false);
    expect(TestMutationObserver.instances.at(-1)!.disconnected).toBe(true);
    expect(document.frames.size).toBe(0);
    expect(document.timers.size).toBe(0);
    controller.unload();
  });

  it.each(['wheel', 'touchstart'])('cancels pending alignment on native reader %s while ignoring the outline panel', event => {
    const { document, host, scroller, nav, controller } = fixture();
    document.flushFrame(); nav.emit('click', { target: nav.children[1] });
    const observer = TestMutationObserver.instances.at(-1)!;
    host.emit(event, { target: nav });
    expect(observer.disconnected).toBe(false);
    expect(document.timers.size).toBe(1);
    host.emit(event, { target: scroller });
    expect(observer.disconnected).toBe(true);
    expect(document.timers.size).toBe(0);
    expect(host.hasClass('kn-outline-jump')).toBe(false);
    renderTarget(scroller, 500); document.flushFrame();
    expect(scroller.scrollTop).toBe(0);
    controller.unload();
  });
});
