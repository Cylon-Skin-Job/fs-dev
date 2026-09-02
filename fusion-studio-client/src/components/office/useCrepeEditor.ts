/**
 * @module useCrepeEditor
 * @role Encapsulates the Crepe (Milkdown) editor lifecycle, toolbar
 *       customisation, markdown-update listener, and teardown.
 */
import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';
import { headingSchema, wrapInHeadingCommand } from '@milkdown/kit/preset/commonmark';
import { commandsCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  spanStyleMark,
  convertHtmlSpansToMarks,
  createAdjustSpanStyleCommand,
  emLabelPlugin,
} from '../../lib/milkdown-span-style';
import { officePlainMarkdownInputRules } from '../../lib/officePlainMarkdown';
import { showToast } from '../../lib/toast';
import type {
  DocumentSettings,
  DocumentTableLayout,
  DocumentTableColors,
} from '../../lib/front-matter';
import type { SaveReason } from '../../state/fileDataStore';
import { installOfficeInsertContextMenu } from './officeInsertMenu';
import { installOfficeTableContextMenu } from './officeTableContextMenu';
import {
  installOfficeTableGeometry,
  type OfficeTableGeometryController,
} from './officeTableGeometry';
import { installOfficeTableConfirmDialog } from './officeTableConfirmDialog';
import {
  installOfficeTableColors,
  type OfficeTableColorsController,
} from './officeTableColors';
import { installOfficeColorPopover } from './officeColorPopover';
import { officeTableNodeView } from './officeTableNodeView';
import {
  installOfficeTableDisplay,
  type OfficeTableDisplayController,
} from './officeTableDisplay';
import { officeTableHardbreakNodeView } from './officeTableHardbreak';
import {
  configureOfficeTableBreakCodec,
  officeTableParagraphSchema,
} from './officeTableBreakCodec';
import {
  configureOfficeTableTitleCodec,
  officeTableTitleHeaderSchema,
  officeTableTitleSchema,
} from './officeTableTitleCodec';
import {
  createOfficeDeferredMarkdownPublicationState,
  createOfficeDirtySaveScheduler,
  dispatchOfficeTableMetadataAction,
  publishOfficeTableMetadataCombinedCallbacks,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataActionResult,
} from './officeTableHistory';
import { runOfficeTableRemoval } from './officeTableRemoval';
import {
  officeTableInitializationNormalizationKey,
  officeTableTitleQuarantinePlugin,
} from './officeTableMutations';

interface UseCrepeEditorOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  filePath: string;
  fileContent: string;
  parsedBody: string;
  tableLayouts: unknown;
  onTableLayoutsChange: (layouts: DocumentTableLayout[]) => void;
  tableColors: unknown;
  onTableColorsChange: (colors: DocumentTableColors[]) => void;
  tableStyles: unknown;
  onTableStylesChange: (styles: unknown) => void;
  pageAlignment: DocumentSettings['alignment'];
  onPageAlignmentChange: (alignment: DocumentSettings['alignment']) => void;
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
  tableLayouts,
  onTableLayoutsChange,
  tableColors,
  onTableColorsChange,
  tableStyles,
  onTableStylesChange,
  pageAlignment: initialPageAlignment,
  onPageAlignmentChange,
  setIsDirty,
  setDirty,
  handleSaveRef,
  bodyRef,
  autoSaveTimerRef,
  sessionStartRef,
  checkpointDueRef,
}: UseCrepeEditorOptions) {
  const crepeRef = useRef<Crepe | null>(null);
  const tableGeometryRef = useRef<OfficeTableGeometryController | null>(null);
  const tableColorsRef = useRef<OfficeTableColorsController | null>(null);
  const tableDisplayRef = useRef<OfficeTableDisplayController | null>(null);
  const initCompleteRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    initCompleteRef.current = false;
    const editorRoot = containerRef.current;
    const deferredMarkdownPublication = createOfficeDeferredMarkdownPublicationState();
    let pageAlignment = initialPageAlignment;
    const unregisterPageAlignment = registerOfficeTableMetadataBindings(editorRoot, {
      readPageAlignment: () => pageAlignment,
      publishPageAlignment: (alignment) => { pageAlignment = alignment; },
    });

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

    const markDirtyAndScheduleSave = createOfficeDirtySaveScheduler({
      filePath,
      setIsDirty,
      setDirty,
      getSessionStart: () => sessionStartRef.current,
      setSessionStart: (startedAt) => { sessionStartRef.current = startedAt; },
      getTimer: () => autoSaveTimerRef.current,
      setTimer: (timer) => { autoSaveTimerRef.current = timer; },
      checkpointDue: () => checkpointDueRef.current,
      save: (reason) => { void handleSaveRef.current({ reason }); },
    });

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: parsedBody,
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.CodeMirror]: false,
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.Table]: false,
      },
      featureConfigs: {
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
            func.group.items = func.group.items.filter((item) => (
              item.key !== 'code' && item.key !== 'latex'
            ));
            func.group.items.forEach((item) => {
              if (item.key === 'link') item.icon = materialIcon('link');
            });
          },
        },
      },
    });

    const insertContextMenu = installOfficeInsertContextMenu(editorRoot, crepe);
    const colorPopover = installOfficeColorPopover();
    const tableColorsController = installOfficeTableColors(editorRoot, tableColors);
    tableColorsRef.current = tableColorsController;
    const tableDisplayController = installOfficeTableDisplay(
      editorRoot,
      tableStyles,
      (prepare) => {
        let result: OfficeTableMetadataActionResult = {
          applied: false,
          reason: 'metadata-unavailable',
        };
        crepe.editor.action((ctx) => {
          result = dispatchOfficeTableMetadataAction(
            editorRoot,
            ctx.get(editorViewCtx),
            prepare,
          );
        });
        return result;
      },
      () => pageAlignment,
    );
    tableDisplayRef.current = tableDisplayController;
    const cleanupTableContextMenu = installOfficeTableContextMenu(
      editorRoot,
      crepe,
      tableColorsController,
      tableDisplayController,
      colorPopover,
      (snapshot, before, document, token) => {
        return publishOfficeTableMetadataCombinedCallbacks({
          publication: deferredMarkdownPublication,
          snapshot,
          before,
          document,
          token,
          publishTables: (tables) => onTableLayoutsChange(tables as DocumentTableLayout[]),
          publishTableColors: (colors) => onTableColorsChange(colors as DocumentTableColors[]),
          publishTableStyles: onTableStylesChange,
          publishPageAlignment: onPageAlignmentChange,
          markDirtyAndScheduleSave,
        });
      },
      (token) => {
        // Forward structure commits publish renderer stores before their live
        // invariant. Suppress the dispatch's Markdown signal regardless of the
        // proposed document because appended transactions may change the live
        // document before the coordinator verifies it.
        return deferredMarkdownPublication.prepare(token);
      },
      (token, document) => deferredMarkdownPublication.cancel(token, document),
      (token) => deferredMarkdownPublication.isCurrent(token),
    );
    const tableConfirmDialog = installOfficeTableConfirmDialog(editorRoot, (request) => {
      let applied = false;
      crepe.editor.action((ctx) => {
        const result = runOfficeTableRemoval({
          root: editorRoot,
          view: ctx.get(editorViewCtx),
          capture: request.capture,
        });
        applied = result.applied;
        if (!result.applied) {
          showToast(result.reason === 'STALE_TARGET'
            ? 'The table changed before it could be removed.'
            : 'The table could not be safely removed.');
        }
      });
      request.restoreEditorFocus();
      if (!applied) console.warn('[OfficeTable] whole-table deletion aborted without changes');
    });
    const tableGeometry = installOfficeTableGeometry(
      editorRoot,
      tableLayouts,
      (prepare) => {
        let result: OfficeTableMetadataActionResult = {
          applied: false,
          reason: 'metadata-unavailable',
        };
        crepe.editor.action((ctx) => {
          result = dispatchOfficeTableMetadataAction(
            editorRoot,
            ctx.get(editorViewCtx),
            prepare,
          );
        });
        return result;
      },
      tableDisplayController.resolveAlignment,
    );
    tableGeometryRef.current = tableGeometry;

    crepe.editor.config(configureOfficeTableBreakCodec);
    crepe.editor.config(configureOfficeTableTitleCodec(tableStyles));
    crepe.editor.use(officeTableParagraphSchema);
    crepe.editor.use(officeTableTitleSchema);
    crepe.editor.use(officeTableTitleHeaderSchema);
    crepe.editor.use(officeTableTitleQuarantinePlugin(editorRoot));
    crepe.editor.use(officeTableNodeView);
    crepe.editor.use(officeTableHardbreakNodeView);
    crepe.editor.use(spanStyleMark);
    crepe.editor.use(emLabelPlugin);
    crepe.editor.use(officePlainMarkdownInputRules);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (!initCompleteRef.current) {
          bodyRef.current = markdown;
          return;
        }
        const currentDocument = _ctx.get(editorViewCtx).state.doc;
        if (deferredMarkdownPublication.suppressMarkdown(currentDocument)) return;
        if (markdown !== bodyRef.current) {
          markDirtyAndScheduleSave();
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
          tr.setMeta('addToHistory', false);
          tr.setMeta(officeTableInitializationNormalizationKey, true);
          view.dispatch(tr);
        }
        const serializer = ctx.get(serializerCtx);
        bodyRef.current = serializer(view.state.doc);
      });
      tableGeometry.applyLayouts();
      tableColorsController.applyColors();
      tableDisplayController.applyDisplay();
      initCompleteRef.current = true;
    });

    return () => {
      insertContextMenu.cleanup();
      tableConfirmDialog.cleanup();
      cleanupTableContextMenu();
      colorPopover.cleanup();
      tableColorsController.cleanup();
      tableColorsRef.current = null;
      tableDisplayController.cleanup();
      unregisterPageAlignment();
      tableDisplayRef.current = null;
      tableGeometry.cleanup();
      tableGeometryRef.current = null;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      crepe.destroy();
      crepeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, fileContent]);

  return { crepeRef, tableGeometryRef, tableColorsRef, tableDisplayRef };
}
