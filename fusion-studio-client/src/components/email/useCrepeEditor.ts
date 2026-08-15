/**
 * @module useCrepeEditor
 * @role Encapsulates the Crepe (Milkdown) editor lifecycle — init, toolbar
 *       customisation, markdown-update listener, and teardown. The main
 *       EmailDocumentPage component owns all refs and passes them in so
 *       handleSave can still close over the stable ref.
 */
import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';
import {
  headingSchema,
  wrapInHeadingCommand,
} from '@milkdown/kit/preset/commonmark';
import { commandsCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  spanStyleMark,
  convertHtmlSpansToMarks,
  createAdjustSpanStyleCommand,
  emLabelPlugin,
} from '../../lib/milkdown-span-style';
import type { SaveReason } from '../../state/fileDataStore';

const PANEL = 'email-viewer';

interface UseCrepeEditorOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  filePath: string;
  fileContent: string;
  parsedBody: string;
  setIsDirty: (dirty: boolean) => void;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
  handleSaveRef: React.MutableRefObject<
    (opts?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => Promise<void>
  >;
  bodyRef: React.MutableRefObject<string>;
  autoSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  sessionStartRef: React.MutableRefObject<number | null>;
  checkpointDueRef: React.MutableRefObject<boolean>;
}

export function useCrepeEditor({
  containerRef,
  filePath,
  fileContent,
  parsedBody,
  setIsDirty,
  setDirty,
  handleSaveRef,
  bodyRef,
  autoSaveTimerRef,
  sessionStartRef,
  checkpointDueRef,
}: UseCrepeEditorOptions) {
  const crepeRef = useRef<Crepe | null>(null);
  const initCompleteRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    initCompleteRef.current = false;

    const materialIcon = (name: string) =>
      `<span class="material-symbols-outlined" style="font-size:18px">${name}</span>`;

    const isHeading = (ctx: Ctx, level: number) => {
      const view = ctx.get(editorViewCtx);
      const { $from } = view.state.selection;
      const node = $from.parent;
      return node.type === headingSchema.type(ctx) && node.attrs.level === level;
    };

    const toggleHeading = (ctx: Ctx, level: number) => {
      const commands = ctx.get(commandsCtx);
      if (isHeading(ctx, level)) {
        commands.call(wrapInHeadingCommand.key, 0);
      } else {
        commands.call(wrapInHeadingCommand.key, level);
      }
    };

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: parsedBody,
      featureConfigs: {
        [Crepe.Feature.BlockEdit]: {
          textGroup: { h1: null, h2: null, h3: null, h4: null, h5: null, h6: null },
        },
        [Crepe.Feature.Toolbar]: {
          buildToolbar: (builder) => {
            const formatting = builder.getGroup('formatting');
            formatting.group.items.forEach((item) => {
              if (item.key === 'bold') item.icon = materialIcon('format_bold');
              if (item.key === 'italic') item.icon = materialIcon('format_italic');
              if (item.key === 'strikethrough') item.icon = materialIcon('format_strikethrough');
            });
            formatting.group.items.unshift(
              { key: 'h1', icon: materialIcon('format_h1'), active: (ctx: Ctx) => isHeading(ctx, 1), onRun: (ctx: Ctx) => toggleHeading(ctx, 1) },
              { key: 'h2', icon: materialIcon('format_h2'), active: (ctx: Ctx) => isHeading(ctx, 2), onRun: (ctx: Ctx) => toggleHeading(ctx, 2) },
              { key: 'h3', icon: materialIcon('format_h3'), active: (ctx: Ctx) => isHeading(ctx, 3), onRun: (ctx: Ctx) => toggleHeading(ctx, 3) },
            );
            formatting.group.items.push(
              {
                key: 'spanStyleDec',
                icon: '<span data-span-style="dec" class="material-symbols-outlined" style="font-size:18px">remove</span>',
                active: () => false,
                onRun: (ctx: Ctx) => {
                  const view = ctx.get(editorViewCtx);
                  createAdjustSpanStyleCommand(-0.1)(view.state, view.dispatch);
                },
              },
              {
                key: 'spanStyleInc',
                icon: '<span data-span-style="inc" class="material-symbols-outlined" style="font-size:18px">add</span>',
                active: () => false,
                onRun: (ctx: Ctx) => {
                  const view = ctx.get(editorViewCtx);
                  createAdjustSpanStyleCommand(0.1)(view.state, view.dispatch);
                },
              },
            );
            const func = builder.getGroup('function');
            func.group.items.forEach((item) => {
              if (item.key === 'code') item.icon = materialIcon('code');
              if (item.key === 'link') item.icon = materialIcon('link');
              if (item.key === 'latex') item.icon = materialIcon('functions');
            });
          },
        },
      },
    });

    crepe.editor.use(spanStyleMark);
    crepe.editor.use(emLabelPlugin);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (!initCompleteRef.current) {
          bodyRef.current = markdown;
          return;
        }
        if (markdown !== bodyRef.current) {
          setIsDirty(true);
          setDirty(PANEL, filePath, true);
          if (sessionStartRef.current === null) {
            sessionStartRef.current = Date.now();
          }
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          autoSaveTimerRef.current = setTimeout(() => {
            const reason: SaveReason = checkpointDueRef.current ? 'checkpoint' : 'autosave';
            handleSaveRef.current({ reason });
          }, 500);
        }
      });
    });

    crepe.create().then(() => {
      crepeRef.current = crepe;
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const doc = view.state.doc;
        const transformed = convertHtmlSpansToMarks(doc);
        if (transformed !== doc) {
          const tr = view.state.tr;
          tr.replaceWith(0, doc.content.size, transformed.content);
          view.dispatch(tr);
        }
        const serializer = ctx.get(serializerCtx);
        bodyRef.current = serializer(view.state.doc);
      });
      initCompleteRef.current = true;
    });

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      crepe.destroy();
      crepeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, fileContent]);

  return { crepeRef };
}
