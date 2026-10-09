/** Leave native composition keys to the input method, including legacy 229 events. */
export function isComposingKeyboardEvent(
  event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>,
): boolean {
  return event.isComposing || event.keyCode === 229;
}
