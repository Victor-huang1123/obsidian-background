import type { SpaceSettings } from './settings';

/**
 * 三種正文字體對應的字型堆疊。筆記本體（main.ts）與外觀設定的預覽卡共用，
 * 確保預覽與實際閱讀面一致。「Knowledge Space JhengHei」必須與
 * local-fonts.ts 的 LOCAL_JHENGHEI_FAMILY 相同，才能套用使用者自備的本機字型。
 */
export const FONT_STACKS: Readonly<Record<SpaceSettings['fontFamily'], string>> = Object.freeze({
  sans: '"Helvetica Neue", "PingFang TC", "Noto Sans TC", sans-serif',
  serif: '"Iowan Old Style", "Songti TC", "Noto Serif TC", serif',
  jhenghei: '"Knowledge Space JhengHei", "Microsoft JhengHei", "Microsoft JhengHei UI", "微軟正黑體", "PingFang TC", sans-serif',
});

export function fontStack(family: SpaceSettings['fontFamily']): string {
  return FONT_STACKS[family] ?? FONT_STACKS.sans;
}
