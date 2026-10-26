import { describe, expect, it, vi } from 'vitest';
import { createResourceCache, cssUrl } from '../src/resource-url';

describe('resource URL cache', () => {
  it('calls the resolver once per path and again when the path changes', () => {
    let token = 0;
    const resolve = vi.fn((path: string) => `app://id/${path}?${++token}`);
    const resource = createResourceCache(resolve);
    expect(resource('a.jpg')).toBe('app://id/a.jpg?1');
    expect(resource('a.jpg')).toBe('app://id/a.jpg?1');
    expect(resource('b.jpg')).toBe('app://id/b.jpg?2');
    // 回到先前的路徑視為新圖片，重新解析一次（只記住最後一條路徑即可）
    expect(resource('a.jpg')).toBe('app://id/a.jpg?3');
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('wraps resources as a quoted CSS url()', () => {
    expect(cssUrl('app://id/x y.png?1')).toBe('url("app://id/x y.png?1")');
    expect(cssUrl('app://id/a"b).png')).toBe('url("app://id/a\\"b).png")');
  });
});
