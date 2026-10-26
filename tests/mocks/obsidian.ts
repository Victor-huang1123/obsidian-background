export { TestComponent as Component } from './outline-dom';
export class MarkdownView {}
export function setIcon(): void {}
/** 記錄顯示過的提示訊息，供測試斷言錯誤處理。 */
export class Notice {
  static messages: string[] = [];
  constructor(readonly message: string) { Notice.messages.push(message); }
}
