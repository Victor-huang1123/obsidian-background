type Listener = (event: Record<string, unknown>) => void;
type Options = string | { cls?: string; text?: string; attr?: Record<string, string> };

export class EventSurface {
  listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, callback: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(callback);
  }
  removeEventListener(type: string, callback: Listener): void { this.listeners.get(type)?.delete(callback); }
  emit(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ target: this, ...event });
  }
  listenerCount(): number { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}

export class TestDocument extends EventSurface {
  private nextFrame = 0;
  private nextTimer = 0;
  readonly body = new TestElement(this, 'body');
  frames = new Map<number, FrameRequestCallback>();
  timers = new Map<number, () => void>();
  defaultView = {
    MutationObserver: TestMutationObserver,
    requestAnimationFrame: (callback: FrameRequestCallback): number => {
      const id = ++this.nextFrame; this.frames.set(id, callback); return id;
    },
    cancelAnimationFrame: (id: number): void => { this.frames.delete(id); },
    setTimeout: (callback: () => void, _delay = 0): number => {
      const id = ++this.nextTimer; this.timers.set(id, callback); return id;
    },
    clearTimeout: (id: number): void => { this.timers.delete(id); },
  };
  flushFrame(): void {
    const pending = [...this.frames];
    for (const [id, callback] of pending) {
      if (!this.frames.delete(id)) continue;
      callback(0);
    }
  }
  flushTimers(): void {
    for (const [id, callback] of [...this.timers]) if (this.timers.delete(id)) callback();
  }
}

export class TestElement extends EventSurface {
  parent: TestElement | null = null;
  children: TestElement[] = [];
  classes = new Set<string>();
  classList = {
    contains: (name: string): boolean => this.hasClass(name),
    add: (...names: string[]): void => this.addClass(...names),
    remove: (...names: string[]): void => this.removeClass(...names),
  };
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style = { setProperty: (_name: string, _value: string): void => undefined };
  textContent = '';
  title = '';
  width = 800;
  top = 100;
  clientHeight = 600;
  scrollHeight = 2000;
  private scrollOffset = 0;
  focused = false;
  constructor(readonly ownerDocument: TestDocument, readonly tagName = 'div') { super(); }
  createEl(tag: string, options: Options = {}): TestElement {
    const node = new TestElement(this.ownerDocument, tag);
    const settings = typeof options === 'string' ? { cls: options } : options;
    if (settings.cls) node.addClass(...settings.cls.split(' '));
    if (settings.text) node.setText(settings.text);
    for (const [key, value] of Object.entries(settings.attr ?? {})) node.setAttribute(key, value);
    return this.appendChild(node);
  }
  createDiv(options: Options = {}): TestElement { return this.createEl('div', options); }
  createSpan(options: Options = {}): TestElement { return this.createEl('span', options); }
  appendChild(node: TestElement): TestElement {
    node.remove(); node.parent = this; this.children.push(node); return node;
  }
  addClass(...names: string[]): void { names.forEach(name => this.classes.add(name)); }
  removeClass(...names: string[]): void { names.forEach(name => this.classes.delete(name)); }
  hasClass(name: string): boolean { return this.classes.has(name); }
  toggleClass(name: string, enabled: boolean): void { enabled ? this.addClass(name) : this.removeClass(name); }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
  }
  removeAttribute(name: string): void { delete this.attrs[name]; }
  setText(text: string): void { this.textContent = text; }
  empty(): void { for (const child of [...this.children]) child.remove(); }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }
  contains(node: TestElement): boolean { return this === node || this.children.some(child => child.contains(node)); }
  matches(selector: string): boolean {
    if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
    const tag = selector.match(/^[\w-]+/)?.[0];
    if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!this.hasClass(match[1])) return false;
    for (const match of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if (!(match[1] in this.attrs)) return false;
      if (match[2] !== undefined && this.attrs[match[1]] !== match[2]) return false;
    }
    return true;
  }
  querySelector(selector: string): TestElement | null { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector: string): TestElement[] {
    const groups = selector.split(',').map(group => group.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/));
    const matchesPath = (node: TestElement, parts: string[], index: number): boolean => {
      if (parts[index] === ':scope') return index === 0 && node === this;
      if (!node.matches(parts[index])) return false;
      if (index === 0) return true;
      if (parts[index - 1] === '>') return !!node.parent && matchesPath(node.parent, parts, index - 2);
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (matchesPath(parent, parts, index - 1)) return true;
      }
      return false;
    };
    const results: TestElement[] = [];
    const visit = (node: TestElement): void => {
      for (const child of node.children) {
        if (groups.some(parts => matchesPath(child, parts, parts.length - 1))) results.push(child);
        visit(child);
      }
    };
    visit(this); return results;
  }
  closest(selector: string): TestElement | null {
    if (this.matches(selector)) return this;
    return this.parent?.closest(selector) ?? null;
  }
  find(cls: string): TestElement | undefined {
    if (this.hasClass(cls)) return this;
    for (const child of this.children) { const found = child.find(cls); if (found) return found; }
    return undefined;
  }
  getBoundingClientRect(): { width: number; top: number; bottom: number; height: number } {
    return { width: this.width, top: this.top, bottom: this.top + this.clientHeight, height: this.clientHeight };
  }
  get parentElement(): TestElement | null { return this.parent; }
  get isConnected(): boolean { return this.parent !== null; }
  get scrollTop(): number { return this.scrollOffset; }
  set scrollTop(value: number) { this.scrollOffset = Math.min(Math.max(0, value), Math.max(0, this.scrollHeight - this.clientHeight)); }
  focus(): void { this.focused = true; }
}

export class TestComponent {
  private cleanup: (() => void)[] = [];
  onload(): void {}
  load(): void { this.onload(); }
  unload(): void { for (const cleanup of this.cleanup.splice(0).reverse()) cleanup(); }
  register(callback: () => void): void { this.cleanup.push(callback); }
  registerDomEvent(target: EventSurface, type: string, callback: Listener): void {
    target.addEventListener(type, callback);
    this.register(() => target.removeEventListener(type, callback));
  }
}

export class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  disconnected = false;
  constructor(private readonly callback: () => void) { TestResizeObserver.instances.push(this); }
  observe(): void {}
  disconnect(): void { this.disconnected = true; }
  deliver(): void { if (!this.disconnected) this.callback(); }
}

export class TestMutationObserver {
  static instances: TestMutationObserver[] = [];
  disconnected = false;
  private target: TestElement | null = null;
  constructor(private readonly callback: (records: unknown[], observer: TestMutationObserver) => void) {
    TestMutationObserver.instances.push(this);
  }
  observe(target: TestElement): void { this.target = target; this.disconnected = false; }
  disconnect(): void { this.disconnected = true; }
  deliver(records: unknown[] = [{ type: 'attributes', attributeName: 'class', target: this.target }]): void {
    if (!this.disconnected) this.callback(records, this);
  }
}
