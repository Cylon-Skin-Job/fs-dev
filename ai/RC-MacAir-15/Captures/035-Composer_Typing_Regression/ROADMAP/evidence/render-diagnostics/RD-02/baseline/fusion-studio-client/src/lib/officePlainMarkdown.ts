/**
 * @module officePlainMarkdown
 * @role Keeps Office documents from turning Markdown code syntax into editor UI.
 */
import { createTimer, type MilkdownPlugin } from '@milkdown/kit/ctx';
import { SchemaReady, editorStateTimerCtx, inputRulesCtx } from '@milkdown/kit/core';
import {
  createCodeBlockInputRule,
  inlineCodeInputRule,
} from '@milkdown/kit/preset/commonmark';
import type { InputRule } from '@milkdown/prose/inputrules';

const OFFICE_PLAIN_MARKDOWN_READY = createTimer('OfficePlainMarkdownReady');

export function officeMarkdownToEditorText(markdown: string) {
  return markdown.replace(/`/g, '\\`');
}

export function editorTextToOfficeMarkdown(markdown: string) {
  return markdown.replace(/\\`/g, '`');
}

function isOfficeCodeInputRule(rule: InputRule) {
  const blockedRules = [
    inlineCodeInputRule.inputRule,
    createCodeBlockInputRule.inputRule,
  ].filter(Boolean);
  const source = (rule as InputRule & { match?: RegExp }).match?.source ?? '';

  return blockedRules.includes(rule) || source === '(?:`)([^`]+)(?:`)$' || source.startsWith('^```');
}

export const officePlainMarkdownInputRules: MilkdownPlugin = (ctx) => {
  ctx.record(OFFICE_PLAIN_MARKDOWN_READY);
  ctx.update(editorStateTimerCtx, (timers) => (
    timers.includes(OFFICE_PLAIN_MARKDOWN_READY)
      ? timers
      : [...timers, OFFICE_PLAIN_MARKDOWN_READY]
  ));

  return async () => {
    await ctx.wait(SchemaReady);
    await Promise.resolve();
    ctx.update(inputRulesCtx, (rules) => rules.filter((rule) => !isOfficeCodeInputRule(rule)));
    ctx.done(OFFICE_PLAIN_MARKDOWN_READY);

    return () => {
      ctx.update(editorStateTimerCtx, (timers) => (
        timers.filter((timer) => timer !== OFFICE_PLAIN_MARKDOWN_READY)
      ));
      ctx.clearTimer(OFFICE_PLAIN_MARKDOWN_READY);
    };
  };
};
