import { normalizePath, type App } from 'obsidian';

export const LOCAL_JHENGHEI_FAMILY = 'Knowledge Space JhengHei';

interface DocumentFonts {
  faces: FontFace[];
  ready: Promise<void>;
}

/** Loads user-provided local assets into their owning document, never the OS. */
export class LocalFonts {
  private readonly documents = new Map<Document, DocumentFonts>();
  private readonly directory: string;
  private disposed = false;

  constructor(private readonly app: App, manifestDir: string) {
    this.directory = normalizePath(`${manifestDir}/assets/fonts`);
  }

  /** Repeated calls share one attempt per document, including absent assets. */
  ensure(doc: Document): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const existing = this.documents.get(doc);
    if (existing) return existing.ready;

    const entry: DocumentFonts = { faces: [], ready: Promise.resolve() };
    this.documents.set(doc, entry);
    entry.ready = this.loadDocument(doc, entry).catch(error => {
      if (this.isCurrent(doc, entry)) console.warn('Knowledge Space local font loading failed', error);
    });
    return entry.ready;
  }

  /** A document can be re-ensured after removal; dispose() permanently stops this manager. */
  dispose(doc?: Document): void {
    if (!doc) {
      this.disposed = true;
      for (const existing of [...this.documents.keys()]) this.dispose(existing);
      return;
    }
    const entry = this.documents.get(doc);
    if (!entry) return;
    // Invalidate pending loads before detaching any already registered faces.
    this.documents.delete(doc);
    for (const face of entry.faces) {
      try { doc.fonts.delete(face); }
      catch (error) { console.warn('Knowledge Space local font cleanup failed', error); }
    }
    entry.faces.length = 0;
  }

  private isCurrent(doc: Document, entry: DocumentFonts): boolean {
    return !this.disposed && this.documents.get(doc) === entry && !!doc.defaultView && !doc.defaultView.closed;
  }

  private async loadDocument(doc: Document, entry: DocumentFonts): Promise<void> {
    const owner = doc.defaultView as (Window & typeof globalThis) | null;
    const Face = owner?.FontFace;
    if (!Face || !doc.fonts || !this.isCurrent(doc, entry)) return;

    const faces = await Promise.all([
      this.loadFace(doc, entry, Face, 'MSJH.ttf', '400'),
      this.loadFace(doc, entry, Face, 'MSJHBD.ttf', '700'),
    ]);
    if (!this.isCurrent(doc, entry)) return;

    for (const face of faces) {
      if (!face) continue;
      try {
        doc.fonts.add(face);
        entry.faces.push(face);
      } catch (error) {
        console.warn('Knowledge Space could not register a local font', error);
      }
    }
  }

  private async loadFace(
    doc: Document,
    entry: DocumentFonts,
    Face: typeof FontFace,
    filename: string,
    weight: string,
  ): Promise<FontFace | null> {
    try {
      const path = normalizePath(`${this.directory}/${filename}`);
      if (!await this.app.vault.adapter.exists(path) || !this.isCurrent(doc, entry)) return null;
      const resource = this.app.vault.adapter.getResourcePath(path);
      const face = new Face(LOCAL_JHENGHEI_FAMILY, `url(${JSON.stringify(resource)}) format("truetype")`, {
        weight, style: 'normal', display: 'swap',
      });
      await face.load();
      return this.isCurrent(doc, entry) ? face : null;
    } catch (error) {
      if (this.isCurrent(doc, entry)) console.warn(`Knowledge Space could not load ${filename}`, error);
      return null;
    }
  }
}
