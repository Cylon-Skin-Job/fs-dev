import { expect, test, type Page } from '@playwright/test'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, type Transaction } from '@milkdown/kit/prose/state'
import { history, redo, undo } from '@milkdown/kit/prose/history'
import { TableMap, tableNodes } from '@milkdown/kit/prose/tables'
import fs from 'node:fs'

import {
  deriveOfficeTableSquareMinimum,
  prepareOfficeTableResizeSnapshot,
} from '../src/components/office/officeTableGeometry'
import {
  createOfficeDeferredMarkdownPublicationState,
  createOfficeTableMetadataProsePlugin,
  dispatchOfficeTableMetadataAction,
  OfficeTableMetadataStep,
  publishOfficeTableMetadataCombinedCallbacks,
  publishOfficeTableMetadataSnapshot,
  registerOfficeTableMetadataBindings,
} from '../src/components/office/officeTableHistory'
import {
  getDocumentTableLayouts,
  parseDocumentSettings,
  parseMarkdownFrontmatter,
  serializeDocumentSettings,
  setDocumentTableStyles,
} from '../src/lib/front-matter'
import {
  planOfficeTableResize,
  type OfficeTableAlignment,
  type OfficeTableResizeInput,
  type OfficeTableResizePlan,
} from '../src/components/office/officeTableResizePlan'
import { planOfficeTableNodeView } from '../src/components/office/officeTableNodeView'
import { resetOfficePlaywrightScenario } from './office/fixture-lifecycle.mjs'

const TABLE_RECT = { left: 100, right: 400 }

function requirePlan(input: OfficeTableResizeInput): OfficeTableResizePlan {
  const plan = planOfficeTableResize(input)
  expect(plan).not.toBeNull()
  return plan as OfficeTableResizePlan
}

function changedIndexes(before: readonly number[], after: readonly number[]): number[] {
  return before.flatMap((width, index) => width === after[index] ? [] : [index])
}

test.describe('[slice 03.1] pure Office table resize planner', () => {
  test('converts the ratified left-outer client deltas at 80%, 100%, and 125% zoom', () => {
    const cases = [
      { scale: 1, clientDelta: -30, expectedDelta: 30 },
      { scale: 1, clientDelta: 30, expectedDelta: -30 },
      { scale: 0.8, clientDelta: -24, expectedDelta: 30 },
      { scale: 0.8, clientDelta: 24, expectedDelta: -30 },
      { scale: 1.25, clientDelta: -37.5, expectedDelta: 30 },
      { scale: 1.25, clientDelta: 37.5, expectedDelta: -30 },
    ]

    for (const { scale, clientDelta, expectedDelta } of cases) {
      const before = [100, 100, 100]
      const plan = requirePlan({
        columns: before,
        boundary: { kind: 'left-outer' },
        alignment: 'left',
        startClientX: 250,
        clientX: 250 + clientDelta,
        scale,
        minimum: 40,
        tableRect: TABLE_RECT,
      })

      expect(plan.layoutDelta).toBe(clientDelta / scale)
      expect(plan.rawDelta).toBe(expectedDelta)
      expect(plan.effectiveDelta).toBe(expectedDelta)
      expect(plan.columns).toEqual([100 + expectedDelta, 100, 100])
      expect(plan.tableWidth).toBe(300 + expectedDelta)
      expect(plan.previewRect).toEqual({ left: 100, right: 400 + expectedDelta * scale })
      expect(plan.guideRect).toEqual({ left: 100, right: 100 })
      expect(plan.changedIndexes).toEqual([0])
      expect(changedIndexes(before, plan.columns)).toEqual([0])
    }
  })

  test('converts symmetric right-outer deltas at 80%, 100%, and 125% zoom', () => {
    const cases = [
      { scale: 1, clientDelta: 30, expectedDelta: 30 },
      { scale: 1, clientDelta: -30, expectedDelta: -30 },
      { scale: 0.8, clientDelta: 24, expectedDelta: 30 },
      { scale: 0.8, clientDelta: -24, expectedDelta: -30 },
      { scale: 1.25, clientDelta: 37.5, expectedDelta: 30 },
      { scale: 1.25, clientDelta: -37.5, expectedDelta: -30 },
    ]

    for (const { scale, clientDelta, expectedDelta } of cases) {
      const before = [100, 100, 100]
      const plan = requirePlan({
        columns: before,
        boundary: { kind: 'right-outer' },
        alignment: 'left',
        startClientX: 250,
        clientX: 250 + clientDelta,
        scale,
        minimum: 40,
        tableRect: TABLE_RECT,
      })

      expect(plan.layoutDelta).toBe(clientDelta / scale)
      expect(plan.rawDelta).toBe(expectedDelta)
      expect(plan.effectiveDelta).toBe(expectedDelta)
      expect(plan.columns).toEqual([100, 100, 100 + expectedDelta])
      expect(plan.tableWidth).toBe(300 + expectedDelta)
      expect(plan.previewRect).toEqual({ left: 100, right: 400 + expectedDelta * scale })
      expect(plan.guideRect).toEqual({
        left: 400 + expectedDelta * scale,
        right: 400 + expectedDelta * scale,
      })
      expect(plan.changedIndexes).toEqual([2])
      expect(changedIndexes(before, plan.columns)).toEqual([2])
    }
  })

  test('rounds and clamps internal positive and negative movement while preserving adjacency and total', () => {
    const before = [100, 120, 140, 160]
    const positive = requirePlan({
      columns: before,
      boundary: { kind: 'internal', index: 2 },
      startClientX: 0,
      clientX: 24.48,
      scale: 0.8,
      minimum: 40,
      tableRect: { left: 10, right: 426 },
    })
    expect(positive.rawDelta).toBe(31)
    expect(positive.effectiveDelta).toBe(31)
    expect(positive.columns).toEqual([100, 151, 109, 160])
    expect(positive.tableWidth).toBe(520)
    expect(positive.previewRect).toEqual({ left: 10, right: 426 })
    expect(positive.guideRect).toEqual({ left: 210.8, right: 210.8 })
    expect(positive.changedIndexes).toEqual([1, 2])
    expect(changedIndexes(before, positive.columns)).toEqual([1, 2])

    const negative = requirePlan({
      columns: before,
      boundary: { kind: 'internal', index: 2 },
      startClientX: 100,
      clientX: 61.9,
      scale: 1.25,
      minimum: 40,
      tableRect: { left: 10, right: 660 },
    })
    expect(negative.rawDelta).toBe(-30)
    expect(negative.effectiveDelta).toBe(-30)
    expect(negative.columns).toEqual([100, 90, 170, 160])
    expect(negative.tableWidth).toBe(520)
    expect(negative.guideRect).toEqual({ left: 247.5, right: 247.5 })
    expect(negative.changedIndexes).toEqual([1, 2])
    expect(changedIndexes(before, negative.columns)).toEqual([1, 2])
  })

  test('applies exact internal clamps without changing non-adjacent columns', () => {
    const positive = requirePlan({
      columns: [75, 90, 50, 110],
      boundary: { kind: 'internal', index: 2 },
      startClientX: 0,
      clientX: 100,
      scale: 1,
      minimum: 40,
      tableRect: { left: 20, right: 345 },
    })
    expect(positive.effectiveDelta).toBe(10)
    expect(positive.columns).toEqual([75, 100, 40, 110])
    expect(positive.tableWidth).toBe(325)
    expect(positive.changedIndexes).toEqual([1, 2])
    expect(positive.guideRect).toEqual({ left: 195, right: 195 })

    const negative = requirePlan({
      columns: [75, 50, 90, 110],
      boundary: { kind: 'internal', index: 1 },
      startClientX: 0,
      clientX: -100,
      scale: 1,
      minimum: 40,
      tableRect: { left: 20, right: 345 },
    })
    expect(negative.effectiveDelta).toBe(-35)
    expect(negative.columns).toEqual([40, 85, 90, 110])
    expect(negative.tableWidth).toBe(325)
    expect(negative.changedIndexes).toEqual([0, 1])
    expect(negative.guideRect).toEqual({ left: 60, right: 60 })
  })

  test('derives exact clamped outer preview and handle-guide rectangles for every alignment', () => {
    const expected: Record<OfficeTableAlignment, {
      preview: { left: number; right: number };
      leftGuide: number;
      rightGuide: number;
    }> = {
      left: { preview: { left: 100, right: 390 }, leftGuide: 100, rightGuide: 390 },
      right: { preview: { left: 110, right: 400 }, leftGuide: 110, rightGuide: 400 },
      center: { preview: { left: 105, right: 395 }, leftGuide: 105, rightGuide: 395 },
    }

    for (const alignment of ['left', 'center', 'right'] as const) {
      const leftPlan = requirePlan({
        columns: [50, 100, 150],
        boundary: { kind: 'left-outer' },
        alignment,
        startClientX: 0,
        clientX: 100,
        scale: 1,
        minimum: 40,
        tableRect: TABLE_RECT,
      })
      expect(leftPlan.rawDelta).toBe(-100)
      expect(leftPlan.effectiveDelta).toBe(-10)
      expect(leftPlan.columns).toEqual([40, 100, 150])
      expect(leftPlan.previewRect).toEqual(expected[alignment].preview)
      expect(leftPlan.guideRect).toEqual({
        left: expected[alignment].leftGuide,
        right: expected[alignment].leftGuide,
      })

      const rightPlan = requirePlan({
        columns: [150, 100, 50],
        boundary: { kind: 'right-outer' },
        alignment,
        startClientX: 0,
        clientX: -100,
        scale: 1,
        minimum: 40,
        tableRect: TABLE_RECT,
      })
      expect(rightPlan.rawDelta).toBe(-100)
      expect(rightPlan.effectiveDelta).toBe(-10)
      expect(rightPlan.columns).toEqual([150, 100, 40])
      expect(rightPlan.previewRect).toEqual(expected[alignment].preview)
      expect(rightPlan.guideRect).toEqual({
        left: expected[alignment].rightGuide,
        right: expected[alignment].rightGuide,
      })
    }
  })

  test('supports one-column outer gestures, two-column adjacency, and N-column isolation', () => {
    const leftSingle = requirePlan({
      columns: [80],
      boundary: { kind: 'left-outer' },
      alignment: 'center',
      startClientX: 0,
      clientX: -20,
      scale: 1,
      minimum: 40,
      tableRect: { left: 100, right: 180 },
    })
    expect(leftSingle.columns).toEqual([100])
    expect(leftSingle.tableWidth).toBe(100)
    expect(leftSingle.changedIndexes).toEqual([0])
    expect(leftSingle.previewRect).toEqual({ left: 90, right: 190 })
    expect(leftSingle.guideRect).toEqual({ left: 90, right: 90 })

    const rightSingle = requirePlan({
      columns: [80],
      boundary: { kind: 'right-outer' },
      alignment: 'right',
      startClientX: 0,
      clientX: 20,
      scale: 1,
      minimum: 40,
      tableRect: { left: 100, right: 180 },
    })
    expect(rightSingle.columns).toEqual([100])
    expect(rightSingle.changedIndexes).toEqual([0])
    expect(rightSingle.previewRect).toEqual({ left: 80, right: 180 })
    expect(rightSingle.guideRect).toEqual({ left: 180, right: 180 })

    const twoColumns = requirePlan({
      columns: [70, 90],
      boundary: { kind: 'internal', index: 1 },
      startClientX: 0,
      clientX: 20,
      scale: 1,
      minimum: 40,
      tableRect: { left: 0, right: 160 },
    })
    expect(twoColumns.columns).toEqual([90, 70])
    expect(twoColumns.tableWidth).toBe(160)
    expect(twoColumns.changedIndexes).toEqual([0, 1])

    const many = requirePlan({
      columns: [50, 60, 70, 80, 90, 100],
      boundary: { kind: 'internal', index: 4 },
      startClientX: 0,
      clientX: -15,
      scale: 1,
      minimum: 40,
      tableRect: { left: 0, right: 450 },
    })
    expect(many.columns).toEqual([50, 60, 70, 65, 105, 100])
    expect(many.tableWidth).toBe(450)
    expect(many.changedIndexes).toEqual([3, 4])
  })

  test('returns an unchanged plan for an effective zero without mutating its input', () => {
    const columns = Object.freeze([40, 80, 100])
    const plan = requirePlan({
      columns,
      boundary: { kind: 'internal', index: 1 },
      startClientX: 10,
      clientX: 10.49,
      scale: 1,
      minimum: 40,
      tableRect: { left: 0, right: 220 },
    })
    expect(plan.rawDelta).toBe(0)
    expect(plan.effectiveDelta).toBe(0)
    expect(plan.columns).toEqual(columns)
    expect(plan.columns).not.toBe(columns)
    expect(plan.changedIndexes).toEqual([])
    expect(plan.tableWidth).toBe(220)
  })

  test('returns no plan for invalid drag-start samples and impossible boundaries', () => {
    const valid: OfficeTableResizeInput = {
      columns: [80, 80],
      boundary: { kind: 'internal', index: 1 },
      startClientX: 0,
      clientX: 10,
      scale: 1,
      minimum: 40,
      tableRect: { left: 0, right: 160 },
    }
    const invalid = [
      { ...valid, columns: [] },
      { ...valid, columns: [80, Number.NaN] },
      { ...valid, columns: [80, 80.5] },
      { ...valid, columns: [80, 39] },
      { ...valid, startClientX: Number.POSITIVE_INFINITY },
      { ...valid, clientX: Number.NaN },
      { ...valid, scale: 0 },
      { ...valid, scale: -1 },
      { ...valid, minimum: 0 },
      { ...valid, minimum: 40.5 },
      { ...valid, minimum: Number.NaN },
      { ...valid, tableRect: { left: 10, right: 10 } },
      { ...valid, tableRect: { left: Number.NaN, right: 160 } },
      { ...valid, boundary: { kind: 'internal' as const, index: 0 } },
      { ...valid, boundary: { kind: 'internal' as const, index: 2 } },
      { ...valid, boundary: { kind: 'internal' as const, index: 1.5 } },
      {
        ...valid,
        boundary: { kind: 'left-outer' as const },
        alignment: 'invalid' as OfficeTableAlignment,
      },
    ]

    for (const input of invalid) expect(planOfficeTableResize(input as OfficeTableResizeInput)).toBeNull()
    expect(planOfficeTableResize({
      ...valid,
      columns: [80],
      boundary: { kind: 'internal', index: 1 },
    })).toBeNull()
  })
})

test.describe('[slice 03.4] exact square minimum box model', () => {
  test('excludes synthetic 1px and 4px presentation strokes from an identical minimum', () => {
    const base = {
      computedMinHeight: 32,
      usedLineHeight: 18.4,
      paddingBlockStart: 9,
      paddingBlockEnd: 11,
    }
    const onePixel = deriveOfficeTableSquareMinimum({ ...base, presentationStroke: 1 })
    const fourPixels = deriveOfficeTableSquareMinimum({ ...base, presentationStroke: 4 })

    expect(onePixel).toBe(39)
    expect(fourPixels).toBe(39)
    expect(fourPixels).toBe(onePixel)
  })

  test('requires finite positive used geometry and accepts a zero computed minimum', () => {
    expect(deriveOfficeTableSquareMinimum({
      computedMinHeight: 0,
      usedLineHeight: 20,
      paddingBlockStart: 9,
      paddingBlockEnd: 11,
      presentationStroke: 1,
    })).toBe(40)
    expect(deriveOfficeTableSquareMinimum({
      computedMinHeight: 0,
      usedLineHeight: Number.NaN,
      paddingBlockStart: 9,
      paddingBlockEnd: 11,
      presentationStroke: 1,
    })).toBeNull()
    expect(deriveOfficeTableSquareMinimum({
      computedMinHeight: 0,
      usedLineHeight: 0,
      paddingBlockStart: 0,
      paddingBlockEnd: 0,
      presentationStroke: 1,
    })).toBeNull()
  })
})

type BoundaryEvidence = {
  table: { left: number; right: number; top: number; height: number; width: number }
  offsetWidth: number
  columns: Array<{ left: number; right: number; width: number }>
  handles: Array<{
    kind: string | undefined
    index: string | undefined
    centerX: number
    top: number
    height: number
    cursor: string
  }>
  overlayInBody: boolean
  editableHandleCount: number
}

async function openGeometryDocument(page: Page, filename: string) {
  await page.goto('/')
  await page.getByTitle('Office', { exact: true }).click()
  const folder = page.getByTitle('001-Fixtures', { exact: true })
  const document = page.getByTitle(filename, { exact: true })
  const editor = page.locator(
    '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
  )
  await expect.poll(async () => (
    await folder.isVisible() || await document.isVisible() || await editor.isVisible()
  ), { timeout: 15_000 }).toBe(true)
  if (!await document.isVisible()) {
    await folder.click()
    await expect(document).toBeVisible()
  }
  await document.click()
  await expect(editor).toBeVisible()
  return editor
}

async function readBoundaryEvidence(page: Page): Promise<BoundaryEvidence> {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLTableElement>('table.rv-office-table')
    const overlay = document.querySelector<HTMLElement>('.rv-office-table-overlay')
    if (!table || !overlay) throw new Error('Office table boundary evidence is unavailable')
    const tableRect = table.getBoundingClientRect()
    return {
      table: {
        left: tableRect.left,
        right: tableRect.right,
        top: tableRect.top,
        height: tableRect.height,
        width: tableRect.width,
      },
      offsetWidth: table.offsetWidth,
      columns: Array.from(table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
        .map((column) => {
          const rect = column.getBoundingClientRect()
          return { left: rect.left, right: rect.right, width: rect.width }
        }),
      handles: Array.from(overlay.querySelectorAll<HTMLElement>('.rv-office-col-grab'))
        .filter((handle) => getComputedStyle(handle).display !== 'none')
        .map((handle) => {
          const rect = handle.getBoundingClientRect()
          return {
            kind: handle.dataset.boundaryKind,
            index: handle.dataset.boundaryIndex,
            centerX: rect.left + rect.width / 2,
            top: rect.top,
            height: rect.height,
            cursor: getComputedStyle(handle).cursor,
          }
        }),
      overlayInBody: overlay.parentElement === document.body,
      editableHandleCount: table.querySelectorAll('.rv-office-col-grab').length,
    }
  })
}

function expectBoundaryEvidence(evidence: BoundaryEvidence, logicalWidth: number, zoom: number) {
  expect(evidence.offsetWidth).toBeGreaterThan(0)
  expect(evidence.table.width / evidence.offsetWidth).toBeCloseTo(zoom, 2)
  expect(evidence.columns).toHaveLength(logicalWidth)
  expect(evidence.handles).toHaveLength(logicalWidth + 1)
  expect(evidence.overlayInBody).toBe(true)
  expect(evidence.editableHandleCount).toBe(0)

  evidence.handles.forEach((handle, boundaryIndex) => {
    const expectedKind = boundaryIndex === 0
      ? 'left-outer'
      : boundaryIndex === logicalWidth ? 'right-outer' : 'internal'
    const expectedX = boundaryIndex === 0
      ? evidence.table.left
      : boundaryIndex === logicalWidth
        ? evidence.table.right
        : evidence.columns[boundaryIndex - 1].right
    expect(handle.kind).toBe(expectedKind)
    expect(handle.index).toBe(String(boundaryIndex))
    expect(handle.cursor).toBe('col-resize')
    expect(Math.abs(handle.centerX - expectedX)).toBeLessThanOrEqual(1)
    expect(Math.abs(handle.top - evidence.table.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(handle.height - evidence.table.height)).toBeLessThanOrEqual(1)
  })
}

function maximumBoundaryError(evidence: BoundaryEvidence, logicalWidth: number): number {
  return evidence.handles.reduce((maximum, handle, boundaryIndex) => {
    const expectedX = boundaryIndex === 0
      ? evidence.table.left
      : boundaryIndex === logicalWidth
        ? evidence.table.right
        : evidence.columns[boundaryIndex - 1].right
    return Math.max(
      maximum,
      Math.abs(handle.centerX - expectedX),
      Math.abs(handle.top - evidence.table.top),
      Math.abs(handle.height - evidence.table.height),
    )
  }, 0)
}

test.describe('[slice 03.2] complete logical Office table boundary overlay', () => {
  test('plans a real installed-schema colspan table from TableMap rather than physical header cells', () => {
    const installedTableNodes = tableNodes({ tableGroup: 'block', cellContent: 'paragraph+' })
    const schema = new Schema({
      nodes: {
        doc: { content: 'table' },
        paragraph: { content: 'text*' },
        text: {},
        ...installedTableNodes,
      },
    })
    const paragraph = (text: string) => schema.node('paragraph', null, schema.text(text))
    const spanningHeader = schema.node('table_header', {
      colspan: 4,
      rowspan: 1,
      colwidth: null,
    }, paragraph('Spanning title'))
    const dataCells = Array.from({ length: 4 }, (_, index) => (
      schema.node('table_cell', null, paragraph(`data-${index}`))
    ))
    const table = schema.node('table', null, [
      schema.node('table_row', null, spanningHeader),
      schema.node('table_row', null, dataCells),
    ])

    expect(table.firstChild?.childCount).toBe(1)
    expect(TableMap.get(table).width).toBe(4)
    expect(planOfficeTableNodeView(table)).toEqual({
      logicalWidth: 4,
      colDefinitions: [0, 1, 2, 3].map((index) => ({ index })),
      boundaryPlans: [
        { kind: 'left-outer', index: 0 },
        { kind: 'internal', index: 1 },
        { kind: 'internal', index: 2 },
        { kind: 'internal', index: 3 },
        { kind: 'right-outer', index: 4 },
      ],
    })
  })

  for (const fixtureCase of [
    { scenario: 'geometry', filename: 'Geometry-One.md', logicalWidth: 1 },
    { scenario: 'basic', filename: 'Basic Tables.md', logicalWidth: 2 },
    { scenario: 'geometry', filename: 'Geometry-Four.md', logicalWidth: 4 },
  ]) {
    test(`renders both outer and every internal handle for ${fixtureCase.logicalWidth} columns at all required zooms`, async ({ page }) => {
      const files = await resetOfficePlaywrightScenario({
        scenario: fixtureCase.scenario,
        copies: 1,
        workspaces: 1,
      })
      expect(files.some(({ filename }: { filename: string }) => filename === fixtureCase.filename)).toBe(true)
      try {
        const editor = await openGeometryDocument(page, fixtureCase.filename)
        const table = editor.locator('table.rv-office-table').first()
        await expect(table).toBeVisible()
        const initialBox = await table.boundingBox()
        if (!initialBox) throw new Error('Geometry fixture table has no bounding box')
        await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2)
        await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab'))
          .toHaveCount(fixtureCase.logicalWidth + 1)

        for (const zoom of [0.8, 1, 1.25]) {
          await page.locator('.rv-office-document-editor').evaluate((element, nextZoom) => {
            ;(element as HTMLElement).style.setProperty('--editor-zoom', String(nextZoom))
          }, zoom)
          await expect.poll(async () => {
            const evidence = await readBoundaryEvidence(page)
            return evidence.table.width / evidence.offsetWidth
          }).toBeCloseTo(zoom, 2)
          const evidence = await readBoundaryEvidence(page)
          expectBoundaryEvidence(evidence, fixtureCase.logicalWidth, zoom)

          const guideHandle = page.locator('.rv-office-table-overlay .rv-office-col-grab').nth(
            Math.min(1, fixtureCase.logicalWidth),
          )
          const guideBox = await guideHandle.boundingBox()
          if (!guideBox) throw new Error('Geometry boundary handle has no bounding box')
          await page.mouse.move(guideBox.x + guideBox.width / 2, guideBox.y + guideBox.height / 2)
          await expect.poll(() => guideHandle.evaluate((handle) => (
            getComputedStyle(handle, '::after').opacity
          ))).toBe('1')
        }

        const guideHandle = page.locator('.rv-office-table-overlay .rv-office-col-grab').nth(
          Math.min(1, fixtureCase.logicalWidth),
        )
        const guideBox = await guideHandle.boundingBox()
        if (!guideBox) throw new Error('Geometry boundary handle has no active-guide box')
        await page.mouse.move(guideBox.x + guideBox.width / 2, guideBox.y + guideBox.height / 2)
        await page.mouse.down()
        await expect(guideHandle).toHaveAttribute('data-active', 'true')
        await expect(page.locator('body')).toHaveClass(/\brv-office-col-resizing\b/)
        await expect.poll(() => guideHandle.evaluate((handle) => (
          getComputedStyle(handle, '::after').opacity
        ))).toBe('1')
        await page.mouse.up()

        await page.locator('.rv-office-document-editor').evaluate((element) => {
          element.scrollTop += 40
        })
        await expect.poll(async () => maximumBoundaryError(
          await readBoundaryEvidence(page),
          fixtureCase.logicalWidth,
        )).toBeLessThanOrEqual(1)
        expectBoundaryEvidence(await readBoundaryEvidence(page), fixtureCase.logicalWidth, 1.25)

        await page.setViewportSize({ width: 1100, height: 760 })
        await expect.poll(async () => maximumBoundaryError(
          await readBoundaryEvidence(page),
          fixtureCase.logicalWidth,
        )).toBeLessThanOrEqual(1)
        expectBoundaryEvidence(await readBoundaryEvidence(page), fixtureCase.logicalWidth, 1.25)

        const wrapper = table.locator('..')
        const horizontalScroll = await wrapper.evaluate((element) => {
          const scrollWrapper = element as HTMLElement
          const scrollTable = scrollWrapper.querySelector<HTMLElement>('table.rv-office-table')
          if (!scrollTable) throw new Error('Geometry wrapper has no Office table')
          const fixedTableWidth = scrollTable.offsetWidth
          scrollTable.style.width = `${fixedTableWidth}px`
          scrollTable.style.minWidth = `${fixedTableWidth}px`
          const renderedTableWidth = scrollTable.getBoundingClientRect().width
          scrollWrapper.style.width = `${Math.max(1, Math.floor(renderedTableWidth * 0.6))}px`
          scrollWrapper.style.overflowX = 'auto'
          const maximumScroll = scrollWrapper.scrollWidth - scrollWrapper.clientWidth
          scrollWrapper.scrollLeft = Math.min(48, maximumScroll)
          scrollWrapper.dispatchEvent(new Event('scroll'))
          return {
            clientWidth: scrollWrapper.clientWidth,
            scrollLeft: scrollWrapper.scrollLeft,
            scrollWidth: scrollWrapper.scrollWidth,
          }
        })
        expect(horizontalScroll.scrollWidth).toBeGreaterThan(horizontalScroll.clientWidth)
        expect(horizontalScroll.scrollLeft).toBeGreaterThan(0)
        await expect.poll(async () => maximumBoundaryError(
          await readBoundaryEvidence(page),
          fixtureCase.logicalWidth,
        )).toBeLessThanOrEqual(1)
        expectBoundaryEvidence(await readBoundaryEvidence(page), fixtureCase.logicalWidth, 1.25)

        if (fixtureCase.logicalWidth === 1) {
          await table.locator('tbody > tr').first().locator('th, td').first().click({ button: 'right' })
          await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
          await expect(table.locator(':scope > colgroup > col')).toHaveCount(2)
          const mutatedBox = await table.boundingBox()
          if (!mutatedBox) throw new Error('Mutated geometry table has no bounding box')
          await page.mouse.move(
            mutatedBox.x + mutatedBox.width / 2,
            mutatedBox.y + mutatedBox.height / 2,
          )
          await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(3)
          expectBoundaryEvidence(await readBoundaryEvidence(page), 2, 1.25)

          await page.keyboard.press('ControlOrMeta+z')
          await expect(table.locator(':scope > colgroup > col')).toHaveCount(1)
          const rebuiltBox = await table.boundingBox()
          if (!rebuiltBox) throw new Error('Rebuilt geometry table has no bounding box')
          await page.mouse.move(
            rebuiltBox.x + rebuiltBox.width / 2,
            rebuiltBox.y + rebuiltBox.height / 2,
          )
          await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(2)
          expectBoundaryEvidence(await readBoundaryEvidence(page), 1, 1.25)

          const originalNodeViewTable = await table.elementHandle()
          if (!originalNodeViewTable) throw new Error('Geometry table has no node-view element handle')
          await table.locator('tbody > tr').first().locator('th, td').first().click()
          await page.keyboard.press('ControlOrMeta+a')
          await page.keyboard.type('temporary rebuild sentinel')
          await expect(editor.locator('table.rv-office-table')).toHaveCount(0)
          await expect.poll(() => originalNodeViewTable.evaluate((element) => element.isConnected))
            .toBe(false)
          await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab').first())
            .toBeHidden()

          await page.keyboard.press('ControlOrMeta+z')
          await expect(table).toBeVisible()
          await expect(table.locator(':scope > colgroup > col')).toHaveCount(1)
          await expect.poll(() => originalNodeViewTable.evaluate((element) => element.isConnected))
            .toBe(false)
          await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(2)
          await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab').first())
            .toBeVisible()
          await expect.poll(async () => maximumBoundaryError(
            await readBoundaryEvidence(page),
            1,
          )).toBeLessThanOrEqual(1)
          expectBoundaryEvidence(await readBoundaryEvidence(page), 1, 1.25)
        }
      } finally {
        await page.close()
        await resetOfficePlaywrightScenario({
          scenario: fixtureCase.scenario,
          copies: 1,
          workspaces: 1,
        })
      }
    })
  }
})

test.describe('[slice 03.3] resize metadata snapshot isolation', () => {
  test('merges only the exact target layout and preserves every sibling domain byte-for-byte', () => {
    const before = {
      tables: [
        {
          tableIndex: 0,
          fingerprint: 'target',
          columns: [90, 110, 130],
          style: { legacy: 'keep-target' },
          futureLayout: ['opaque', 7],
        },
        {
          tableIndex: 1,
          fingerprint: 'sibling',
          columns: [101, 121],
          style: { legacy: 'keep-sibling' },
          futureLayout: { exact: true },
        },
        { unknownCollectionEntry: 'keep' },
      ],
      tableColors: [{ tableIndex: 0, cells: { '0,0': '#112233' } }],
    }
    const frozenBefore = structuredClone(before)
    const after = prepareOfficeTableResizeSnapshot(
      before,
      { tableIndex: 0, fingerprint: 'target' },
      [120, 80, 130],
    )

    expect(after).toEqual({
      tables: [
        {
          ...before.tables[0],
          columns: [120, 80, 130],
        },
        before.tables[1],
        before.tables[2],
      ],
      tableColors: before.tableColors,
    })
    expect(before).toEqual(frozenBefore)
    expect(after?.tables).not.toBe(before.tables)
    expect(after?.tableColors).not.toBe(before.tableColors)
  })

  test('materializes only the resized keyless target and treats exact or invalid widths as no-op', () => {
    const before = { tables: [], tableColors: [{ futureColor: 'keep' }] }
    expect(prepareOfficeTableResizeSnapshot(
      before,
      { tableIndex: 2, fingerprint: 'target-keyless' },
      [80, 100],
    )).toEqual({
      tables: [{ tableIndex: 2, fingerprint: 'target-keyless', columns: [80, 100] }],
      tableColors: before.tableColors,
    })
    expect(prepareOfficeTableResizeSnapshot(
      {
        tables: [{ tableIndex: 2, fingerprint: 'target-keyless', columns: [80, 100] }],
        tableColors: before.tableColors,
      },
      { tableIndex: 2, fingerprint: 'target-keyless' },
      [80, 100],
    )).toBeNull()
    expect(prepareOfficeTableResizeSnapshot(
      before,
      { tableIndex: 2, fingerprint: 'target-keyless' },
      [80, Number.NaN],
    )).toBeNull()
  })

  test('dispatches exactly one metadata Step callback dirty and save for Forward Undo and Redo', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'paragraph' },
        paragraph: { content: 'text*' },
        text: {},
      },
    })
    const root = {} as HTMLElement
    const publication = createOfficeDeferredMarkdownPublicationState()
    let tables: unknown = [{
      tableIndex: 0,
      fingerprint: 'target',
      columns: [100, 140],
      futureLayout: 'keep',
    }]
    let tableColors: unknown = [{ tableIndex: 0, futureColor: 'keep' }]
    let pluginTableCallbacks = 0
    let externalTableCallbacks = 0
    let dirty = 0
    let saves = 0
    const unregister = registerOfficeTableMetadataBindings(root, {
      readTables: () => structuredClone(tables),
      publishTables: (next) => {
        pluginTableCallbacks += 1
        tables = structuredClone(next)
      },
      readTableColors: () => structuredClone(tableColors),
      publishTableColors: (next) => { tableColors = structuredClone(next) },
      prepareDeferredSnapshot: (token) => publication.prepare(token),
      cancelDeferredSnapshot: (token, document) => publication.cancel(token, document),
      isCurrentSnapshot: (token) => publication.isCurrent(token),
      publishSnapshot: (snapshot, before, document, token) => (
        publishOfficeTableMetadataCombinedCallbacks({
          publication,
          snapshot,
          before,
          document,
          token,
          publishTables: () => { externalTableCallbacks += 1 },
          publishTableColors: () => {},
          markDirtyAndScheduleSave: () => {
            dirty += 1
            saves += 1
          },
        })
      ),
    })
    const plugin = createOfficeTableMetadataProsePlugin(
      (snapshot, document, deferExternal, token) => publishOfficeTableMetadataSnapshot(
        root,
        snapshot,
        document,
        { deferExternal, token },
      ),
    )
    let state = EditorState.create({
      schema,
      doc: schema.node('doc', null, schema.node('paragraph')),
      plugins: [history(), plugin],
    })
    const stepsPerDispatch: number[] = []
    const view = {
      get state() { return state },
      dispatch(transaction: Transaction) {
        const applied = state.applyTransaction(transaction)
        stepsPerDispatch.push(applied.transactions.reduce((count, candidate) => (
          count + candidate.steps.filter((step) => step instanceof OfficeTableMetadataStep).length
        ), 0))
        state = applied.state
      },
    }

    try {
      const result = dispatchOfficeTableMetadataAction(root, view, (before) => (
        prepareOfficeTableResizeSnapshot(
          before,
          { tableIndex: 0, fingerprint: 'target' },
          [120, 120],
        )
      ))
      expect(result.applied).toBe(true)
      expect(stepsPerDispatch).toEqual([1])
      expect(pluginTableCallbacks).toBe(1)
      expect(externalTableCallbacks).toBe(1)
      expect(dirty).toBe(1)
      expect(saves).toBe(1)
      expect(tables).toEqual([expect.objectContaining({ columns: [120, 120] })])
      expect(tableColors).toEqual([{ tableIndex: 0, futureColor: 'keep' }])

      expect(undo(view.state, view.dispatch.bind(view))).toBe(true)
      expect(stepsPerDispatch).toEqual([1, 1])
      expect(pluginTableCallbacks).toBe(2)
      expect(externalTableCallbacks).toBe(2)
      expect(dirty).toBe(2)
      expect(saves).toBe(2)
      expect(tables).toEqual([expect.objectContaining({ columns: [100, 140] })])

      expect(redo(view.state, view.dispatch.bind(view))).toBe(true)
      expect(stepsPerDispatch).toEqual([1, 1, 1])
      expect(pluginTableCallbacks).toBe(3)
      expect(externalTableCallbacks).toBe(3)
      expect(dirty).toBe(3)
      expect(saves).toBe(3)
      expect(tables).toEqual([expect.objectContaining({ columns: [120, 120] })])

      const noChange = dispatchOfficeTableMetadataAction(root, view, (before) => (
        prepareOfficeTableResizeSnapshot(
          before,
          { tableIndex: 0, fingerprint: 'target' },
          [120, 120],
        )
      ))
      expect(noChange).toEqual(expect.objectContaining({ applied: false, reason: 'no-change' }))
      expect(stepsPerDispatch).toEqual([1, 1, 1])
      expect(pluginTableCallbacks).toBe(3)
      expect(externalTableCallbacks).toBe(3)
      expect(dirty).toBe(3)
      expect(saves).toBe(3)
    } finally {
      unregister()
    }
  })
})

async function captureGeometrySaveMessages(page: Page) {
  await page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    const observed = window as typeof window & { __geometrySentMessages?: unknown[] }
    observed.__geometrySentMessages = []
    WebSocket.prototype.send = function captureGeometrySend(data) {
      if (typeof data === 'string') {
        try {
          observed.__geometrySentMessages?.push(JSON.parse(data))
        } catch { /* preserve non-JSON traffic */ }
      }
      return originalSend.call(this, data)
    }
  })
  return () => page.evaluate(() => (
    (window as typeof window & { __geometrySentMessages?: Array<{ type?: string }> })
      .__geometrySentMessages?.filter(({ type }) => type === 'file_save').length ?? 0
  ))
}

function readGeometryLayouts(fixturePath: string): unknown {
  return getDocumentTableLayouts(
    parseMarkdownFrontmatter(fs.readFileSync(fixturePath, 'utf8')).frontmatter,
  )
}

async function readLayoutWidths(table: ReturnType<Page['locator']>): Promise<number[]> {
  return table.evaluate((element) => {
    const htmlTable = element as HTMLTableElement
    const scale = htmlTable.getBoundingClientRect().width / htmlTable.offsetWidth
    return Array.from(htmlTable.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'))
      .map((column) => Math.round(column.getBoundingClientRect().width / scale))
  })
}

type TableGeometrySnapshot = {
  columns: number[]
  rect: { left: number; right: number; width: number }
}

async function readTableGeometry(
  table: ReturnType<Page['locator']>,
): Promise<TableGeometrySnapshot> {
  return table.evaluate((element) => {
    const htmlTable = element as HTMLTableElement
    const rect = htmlTable.getBoundingClientRect()
    const scale = rect.width / htmlTable.offsetWidth
    return {
      columns: Array.from(
        htmlTable.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col'),
      ).map((column) => Math.round(column.getBoundingClientRect().width / scale)),
      rect: { left: rect.left, right: rect.right, width: rect.width },
    }
  })
}

function expectTableGeometryClose(
  actual: TableGeometrySnapshot,
  expected: TableGeometrySnapshot,
  tolerance = 1,
) {
  expect(actual.columns).toHaveLength(expected.columns.length)
  actual.columns.forEach((width, index) => {
    expect(Math.abs(width - expected.columns[index])).toBeLessThanOrEqual(tolerance)
  })
  expect(Math.abs(actual.rect.left - expected.rect.left)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(actual.rect.right - expected.rect.right)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(actual.rect.width - expected.rect.width)).toBeLessThanOrEqual(tolerance)
}

async function dragGeometryBoundary(
  page: Page,
  boundaryIndex: number,
  clientDelta: number,
) {
  const handle = page.locator('.rv-office-table-overlay .rv-office-col-grab').nth(boundaryIndex)
  const box = await handle.boundingBox()
  if (!box) throw new Error(`Geometry boundary ${boundaryIndex} has no bounding box`)
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + clientDelta, startY)
  await page.mouse.up()
}

test('[slice 03.3] internal and outer resize commit Undo Redo save reopen and preserve target-only siblings', async ({ page }) => {
  test.setTimeout(90_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'table-lifecycle', copies: 1, workspaces: 1,
  })
  const fixture = files.find(
    ({ filename }: { filename: string }) => filename === 'Table Lifecycle.md',
  )
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalFrontmatter = parseMarkdownFrontmatter(canonical.toString()).frontmatter
  const canonicalMetadata = structuredClone(canonicalFrontmatter.metadata) as Record<string, unknown>
  const saveCount = await captureGeometrySaveMessages(page)

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    const target = tables.nth(0)
    await expect(tables).toHaveCount(3)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)
    const targetBox = await target.boundingBox()
    if (!targetBox) throw new Error('Geometry target table has no bounding box')
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2)
    await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(3)

    const beforeDom = await readLayoutWidths(target)
    expect(beforeDom).toEqual([100, 140])
    await dragGeometryBoundary(page, 1, 20)
    await expect.poll(saveCount).toBe(1)
    const internalDom = await readLayoutWidths(target)
    expect(internalDom).toEqual([120, 120])
    expect(internalDom.reduce((sum, width) => sum + width, 0)).toBe(240)
    const internalLayouts = readGeometryLayouts(fixture!.path) as Array<Record<string, unknown>>
    expect(internalLayouts[0]).toEqual(expect.objectContaining({ columns: [120, 120] }))
    expect(internalLayouts.slice(1)).toEqual((canonicalMetadata.tables as unknown[]).slice(1))
    const internalMetadata = parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>
    expect(internalMetadata.tableColors).toEqual(canonicalMetadata.tableColors)
    expect(internalMetadata.tableStyles).toEqual(canonicalMetadata.tableStyles)
    expect(internalMetadata.preserveUnknown).toEqual(canonicalMetadata.preserveUnknown)
    expect(internalMetadata.fixtureCase).toEqual(canonicalMetadata.fixtureCase)
    expect(internalMetadata.fixtureCopy).toEqual(canonicalMetadata.fixtureCopy)
    expect(internalMetadata.fixtureScenario).toEqual(canonicalMetadata.fixtureScenario)
    expect(internalLayouts.every((layout) => !Object.hasOwn(layout, 'rows'))).toBe(true)

    await target.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(2)
    await expect.poll(() => readLayoutWidths(target)).toEqual([100, 140])
    expect(readGeometryLayouts(fixture!.path)).toEqual(canonicalMetadata.tables)

    await target.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(saveCount).toBe(3)
    await expect.poll(() => readLayoutWidths(target)).toEqual([120, 120])
    expect(readGeometryLayouts(fixture!.path)).toEqual(internalLayouts)

    const currentBox = await target.boundingBox()
    if (!currentBox) throw new Error('Geometry target table has no outer handle box')
    await page.mouse.move(currentBox.x + currentBox.width / 2, currentBox.y + currentBox.height / 2)
    await dragGeometryBoundary(page, 2, 30)
    await expect.poll(saveCount).toBe(4)
    const outerDom = await readLayoutWidths(target)
    expect(outerDom).toEqual([120, 150])
    expect(outerDom.reduce((sum, width) => sum + width, 0)).toBe(270)
    const outerLayouts = readGeometryLayouts(fixture!.path) as Array<Record<string, unknown>>
    expect(outerLayouts[0]).toEqual(expect.objectContaining({ columns: [120, 150] }))
    expect(outerLayouts.slice(1)).toEqual(internalLayouts.slice(1))

    await target.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(5)
    await expect.poll(() => readLayoutWidths(target)).toEqual([120, 120])
    expect(readGeometryLayouts(fixture!.path)).toEqual(internalLayouts)
    await target.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(saveCount).toBe(6)
    await expect.poll(() => readLayoutWidths(target)).toEqual([120, 150])
    expect(readGeometryLayouts(fixture!.path)).toEqual(outerLayouts)

    await page.reload()
    const reopened = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
    )
    await expect(reopened).toBeVisible()
    await expect.poll(() => readLayoutWidths(reopened.locator('table.rv-office-table').first()))
      .toEqual([120, 150])
    expect(readGeometryLayouts(fixture!.path)).toEqual(outerLayouts)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({
      scenario: 'table-lifecycle', copies: 1, workspaces: 1,
    })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

test('[slice 03.3] first keyless resize Undo clears DOM geometry and Redo save reopen restore only the target', async ({ page }) => {
  test.setTimeout(90_000)
  const files = await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Basic Tables.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const canonicalMetadata = parseMarkdownFrontmatter(canonical.toString()).frontmatter.metadata as
    Record<string, unknown>
  expect(Object.hasOwn(canonicalMetadata, 'tables')).toBe(false)
  const saveCount = await captureGeometrySaveMessages(page)

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const tables = editor.locator('table.rv-office-table')
    await expect(tables).toHaveCount(2)
    const target = tables.first()
    const sibling = tables.nth(1)
    const targetBefore = await readTableGeometry(target)
    const siblingBefore = await readTableGeometry(sibling)
    expect(targetBefore.columns.every(Number.isFinite)).toBe(true)
    expect(siblingBefore.columns.every(Number.isFinite)).toBe(true)

    const targetBox = await target.boundingBox()
    if (!targetBox) throw new Error('Keyless resize target has no bounding box')
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2)
    await dragGeometryBoundary(page, 2, 30)
    await expect.poll(saveCount).toBe(1)
    const forward = await readTableGeometry(target)
    expect(forward.columns).toEqual([
      targetBefore.columns[0],
      targetBefore.columns[1] + 30,
    ])
    expect(Math.abs((forward.rect.width - targetBefore.rect.width) - 30))
      .toBeLessThanOrEqual(1)
    expectTableGeometryClose(await readTableGeometry(sibling), siblingBefore)
    const forwardLayouts = readGeometryLayouts(fixture!.path) as Array<Record<string, unknown>>
    expect(forwardLayouts).toHaveLength(1)
    expect(forwardLayouts[0]).toEqual(expect.objectContaining({
      tableIndex: 0,
      columns: forward.columns,
    }))

    await target.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(2)
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([])
    const undoMetadata = parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>
    expect(Object.hasOwn(undoMetadata, 'tables')).toBe(false)
    await expect.poll(async () => {
      const actual = await readTableGeometry(target)
      return actual.columns
    }).toEqual(targetBefore.columns)
    expectTableGeometryClose(await readTableGeometry(target), targetBefore)
    expectTableGeometryClose(await readTableGeometry(sibling), siblingBefore)

    await target.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(saveCount).toBe(3)
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual(forwardLayouts)
    await expect.poll(async () => (await readTableGeometry(target)).columns).toEqual(forward.columns)
    expectTableGeometryClose(await readTableGeometry(target), forward)
    expectTableGeometryClose(await readTableGeometry(sibling), siblingBefore)

    await page.reload()
    const reopened = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
    )
    await expect(reopened).toBeVisible()
    const reopenedTables = reopened.locator('table.rv-office-table')
    await expect(reopenedTables).toHaveCount(2)
    await expect.poll(async () => (await readTableGeometry(reopenedTables.first())).columns)
      .toEqual(forward.columns)
    expectTableGeometryClose(await readTableGeometry(reopenedTables.first()), forward)
    expectTableGeometryClose(await readTableGeometry(reopenedTables.nth(1)), siblingBefore)
    expect(readGeometryLayouts(fixture!.path)).toEqual(forwardLayouts)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'basic', copies: 1, workspaces: 1 })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

type GeometryCleanupEvidence = {
  resizing: boolean
  active: number
  visible: number
  captured: boolean
}

type GeometryMetadataCounters = {
  steps: number
  pluginPublications: number
  externalPublications: number
}

async function readGeometryMetadataCounters(page: Page): Promise<GeometryMetadataCounters> {
  return page.evaluate(() => (
    (window as typeof window & { __geometryMetadataCounters?: GeometryMetadataCounters })
      .__geometryMetadataCounters ?? { steps: 0, pluginPublications: 0, externalPublications: 0 }
  ))
}

async function resetGeometryMetadataCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as typeof window & { __geometryMetadataCounters?: GeometryMetadataCounters })
      .__geometryMetadataCounters = { steps: 0, pluginPublications: 0, externalPublications: 0 }
  })
}

async function readGeometryCleanup(page: Page): Promise<GeometryCleanupEvidence> {
  return page.evaluate(() => {
    const handles = Array.from(document.querySelectorAll<HTMLElement>(
      '.rv-office-table-overlay .rv-office-col-grab',
    ))
    const pointerId = (window as typeof window & { __geometryPointerId?: number })
      .__geometryPointerId ?? 1
    return {
      resizing: document.body.classList.contains('rv-office-col-resizing'),
      active: handles.filter((handle) => handle.dataset.active === 'true').length,
      visible: handles.filter((handle) => getComputedStyle(handle).display !== 'none').length,
      captured: handles.some((handle) => {
        try { return handle.hasPointerCapture(pointerId) } catch { return false }
      }),
    }
  })
}

test('[slice 03.3] zero clamped-zero cancel lost-capture blur Escape and disconnect are complete no-ops', async ({ page }) => {
  test.setTimeout(90_000)
  const files = await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Geometry-One.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  let noOpBaseline = canonical
  const saveCount = await captureGeometrySaveMessages(page)
  await page.addInitScript(() => {
    const observed = window as typeof window & {
      __geometryMetadataCounters?: GeometryMetadataCounters
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__geometryMetadataCounters = {
      steps: 0,
      pluginPublications: 0,
      externalPublications: 0,
    }
    observed.__officeTableMetadataTestHook = (event) => {
      const counters = observed.__geometryMetadataCounters
      if (!counters) return
      if (event === 'step') counters.steps += 1
      if (event === 'plugin-publish') counters.pluginPublications += 1
      if (event === 'external-publish') counters.externalPublications += 1
    }
    window.addEventListener('pointerdown', (event) => {
      ;(window as typeof window & { __geometryPointerId?: number }).__geometryPointerId = event.pointerId
    }, true)
  })

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const box = await table.boundingBox()
    if (!box) throw new Error('Geometry cancellation table has no box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const handle = page.locator('.rv-office-table-overlay .rv-office-col-grab').nth(1)
    await expect(handle).toBeVisible()
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)

    const begin = async (delta = 24) => {
      const tableBox = await table.boundingBox()
      if (!tableBox) throw new Error('Geometry cancellation table is disconnected')
      await page.mouse.move(
        tableBox.x + tableBox.width / 2,
        tableBox.y + tableBox.height / 2,
      )
      await expect(handle).toBeVisible()
      const before = await readTableGeometry(table)
      const handleBox = await handle.boundingBox()
      if (!handleBox) throw new Error('Geometry cancellation handle has no box')
      const x = handleBox.x + handleBox.width / 2
      const y = handleBox.y + handleBox.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      if (delta) await page.mouse.move(x + delta, y)
      return before
    }
    const assertNoOp = async (
      before: TableGeometrySnapshot,
      { visible = 2, probeHistory = false } = {},
    ) => {
      if (visible > 0) {
        const tableBox = await table.boundingBox()
        if (!tableBox) throw new Error('Geometry cancellation table was unexpectedly removed')
        await page.mouse.move(
          tableBox.x + tableBox.width / 2,
          tableBox.y + tableBox.height / 2,
        )
        await table.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          element.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          }))
        })
      }
      await expect.poll(() => readGeometryCleanup(page)).toEqual({
        resizing: false,
        active: 0,
        visible,
        captured: false,
      })
      expect(await saveCount()).toBe(0)
      expect(await readGeometryMetadataCounters(page)).toEqual({
        steps: 0,
        pluginPublications: 0,
        externalPublications: 0,
      })
      expect(fs.readFileSync(fixture!.path)).toEqual(noOpBaseline)
      await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
      if (visible > 0) {
        expectTableGeometryClose(await readTableGeometry(table), before)
        const logicalWidth = before.columns.length
        await expect.poll(async () => maximumBoundaryError(
          await readBoundaryEvidence(page),
          logicalWidth,
        )).toBeLessThanOrEqual(1)
        expectBoundaryEvidence(await readBoundaryEvidence(page), logicalWidth, 1)
      }
      if (probeHistory) {
        await table.locator('tbody > tr').first().locator('th, td').first().click()
        await page.keyboard.press('ControlOrMeta+z')
        await page.waitForTimeout(150)
        expect(await saveCount()).toBe(0)
        expect(await readGeometryMetadataCounters(page)).toEqual({
          steps: 0,
          pluginPublications: 0,
          externalPublications: 0,
        })
        expect(fs.readFileSync(fixture!.path)).toEqual(noOpBaseline)
        await expect(page.locator('.rv-office-document-dirty')).toHaveCount(0)
        if (visible > 0) expectTableGeometryClose(await readTableGeometry(table), before)
      }
    }

    const zeroBefore = await begin(0)
    await page.mouse.up()
    await assertNoOp(zeroBefore, { probeHistory: true })

    await begin(-10_000)
    await page.mouse.up()
    await expect.poll(saveCount).toBe(1)
    const minimumBytes = fs.readFileSync(fixture!.path)
    await page.waitForTimeout(600)
    noOpBaseline = minimumBytes
    await page.evaluate(() => {
      ;(window as typeof window & { __geometrySentMessages?: unknown[] }).__geometrySentMessages = []
    })
    await resetGeometryMetadataCounters(page)
    const clampedBefore = await begin(-100)
    await page.mouse.up()
    await assertNoOp(clampedBefore)
    expect(fs.readFileSync(fixture!.path)).toEqual(minimumBytes)

    await table.locator('tbody > tr').first().locator('th, td').first().click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(saveCount).toBe(1)
    expect(await readGeometryMetadataCounters(page)).toEqual({
      steps: 1,
      pluginPublications: 1,
      externalPublications: 1,
    })
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([
      expect.objectContaining({ columns: [120] }),
    ])
    noOpBaseline = fs.readFileSync(fixture!.path)
    await page.evaluate(() => {
      ;(window as typeof window & { __geometrySentMessages?: unknown[] }).__geometrySentMessages = []
    })
    await resetGeometryMetadataCounters(page)

    const pointerCancelBefore = await begin()
    await page.evaluate(() => {
      const pointerId = (window as typeof window & { __geometryPointerId?: number })
        .__geometryPointerId ?? 1
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId }))
    })
    await assertNoOp(pointerCancelBefore, { probeHistory: true })

    const lostCaptureBefore = await begin()
    await page.evaluate(() => {
      const pointerId = (window as typeof window & { __geometryPointerId?: number })
        .__geometryPointerId ?? 1
      const active = document.querySelector<HTMLElement>(
        '.rv-office-table-overlay .rv-office-col-grab[data-active="true"]',
      )
      if (!active) throw new Error('No active geometry capture target')
      if (active.hasPointerCapture(pointerId)) active.releasePointerCapture(pointerId)
      else active.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId }))
    })
    await assertNoOp(lostCaptureBefore, { probeHistory: true })

    const blurBefore = await begin()
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await assertNoOp(blurBefore, { probeHistory: true })

    const escapeBefore = await begin()
    await page.keyboard.press('Escape')
    await assertNoOp(escapeBefore, { probeHistory: true })

    const disconnectBefore = await begin()
    const detachedTable = await table.elementHandle()
    if (!detachedTable) throw new Error('Geometry cancellation table has no element handle')
    const detachedStylesBefore = await detachedTable.evaluate((element) => ({
      table: element.getAttribute('style'),
      columns: Array.from(element.querySelectorAll(':scope > colgroup > col'))
        .map((column) => column.getAttribute('style')),
    }))
    await table.evaluate((element) => element.remove())
    await page.mouse.up()
    await assertNoOp(disconnectBefore, { visible: 0 })
    expect(await detachedTable.evaluate((element) => ({
      table: element.getAttribute('style'),
      columns: Array.from(element.querySelectorAll(':scope > colgroup > col'))
        .map((column) => column.getAttribute('style')),
    }))).toEqual(detachedStylesBefore)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

type SquareMinimumEvidence = {
  minimum: number
  scale: number
  outerWidth: number
  outerHeight: number
  paddingInlineStart: number
  paddingInlineEnd: number
  quarterCh: number
  borderWidths: number[]
  boxSizing: string
  boxShadow: string
  lineHeight: string
  minHeight: string
}

async function readSquareMinimumEvidence(
  table: ReturnType<Page['locator']>,
): Promise<SquareMinimumEvidence> {
  return table.evaluate((element) => {
    const htmlTable = element as HTMLTableElement
    const cell = Array.from(htmlTable.rows)
      .flatMap((row) => Array.from(row.cells))
      .find((candidate) => candidate.tagName === 'TD')
    if (!cell) throw new Error('Square-minimum evidence has no regular data cell')
    const tableRect = htmlTable.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    const style = getComputedStyle(cell)
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    Object.assign(probe.style, {
      position: 'fixed',
      left: '-100000px',
      visibility: 'hidden',
      pointerEvents: 'none',
      boxSizing: 'content-box',
      width: '0.25ch',
      height: '0',
      padding: '0',
      border: '0',
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStretch: style.fontStretch,
      fontStyle: style.fontStyle,
      fontVariant: style.fontVariant,
      fontWeight: style.fontWeight,
    })
    document.body.appendChild(probe)
    const quarterCh = probe.getBoundingClientRect().width
    probe.remove()
    const scale = tableRect.width / htmlTable.offsetWidth
    return {
      minimum: Number.parseFloat(
        htmlTable.style.getPropertyValue('--rv-office-table-cell-min-width'),
      ),
      scale,
      outerWidth: cellRect.width / scale,
      outerHeight: cellRect.height / scale,
      paddingInlineStart: Number.parseFloat(style.paddingInlineStart),
      paddingInlineEnd: Number.parseFloat(style.paddingInlineEnd),
      quarterCh,
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].map(Number.parseFloat),
      boxSizing: style.boxSizing,
      boxShadow: style.boxShadow,
      lineHeight: style.lineHeight,
      minHeight: style.minHeight,
    }
  })
}

test('[slice 03.4] canonical clamp is a true square with exact inline breathing room at every zoom', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Geometry-One.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const saveCount = await captureGeometrySaveMessages(page)

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const dataCell = table.locator('td').first()
    await dataCell.click({ clickCount: 3 })
    await page.keyboard.type('x')
    await expect(dataCell).toHaveText('x')
    await expect.poll(saveCount).toBe(1)

    let expectedSaveCount = 1
    let finalColumns: number[] = []
    for (const zoom of [0.8, 1, 1.25]) {
      await page.locator('.rv-office-document-editor').evaluate((element, nextZoom) => {
        ;(element as HTMLElement).style.setProperty('--editor-zoom', String(nextZoom))
      }, zoom)
      const box = await table.boundingBox()
      if (!box) throw new Error('Square-minimum table has no bounding box')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(2)
      await dragGeometryBoundary(page, 1, -10_000)
      expectedSaveCount += 1
      await expect.poll(saveCount).toBe(expectedSaveCount)

      const evidence = await readSquareMinimumEvidence(table)
      expect(Math.abs(evidence.scale - zoom)).toBeLessThanOrEqual(0.01)
      expect(evidence.minimum).toBeGreaterThan(0)
      expect(Math.abs(evidence.outerWidth - evidence.minimum)).toBeLessThanOrEqual(1)
      expect(
        Math.abs(evidence.outerHeight - evidence.minimum),
        JSON.stringify(evidence),
      ).toBeLessThanOrEqual(1)
      expect(Math.abs(evidence.outerWidth - evidence.outerHeight)).toBeLessThanOrEqual(1)
      expect(evidence.paddingInlineStart).toBeCloseTo(evidence.quarterCh, 2)
      expect(evidence.paddingInlineEnd).toBeCloseTo(evidence.quarterCh, 2)
      expect(evidence.borderWidths).toEqual([0, 0, 0, 0])
      expect(evidence.boxSizing).toBe('border-box')
      // SPEC-09 moved grid paint from layout-adjacent cell shadows to absolute
      // pseudo-elements; the canonical cell itself remains paint-free here.
      expect(evidence.boxShadow).toBe('none')
      expect(evidence.lineHeight.length).toBeGreaterThan(0)
      expect(evidence.minHeight.length).toBeGreaterThan(0)
      finalColumns = await readLayoutWidths(table)
      expect(finalColumns).toEqual([evidence.minimum])
      const layouts = readGeometryLayouts(fixture!.path) as Array<Record<string, unknown>>
      expect(layouts).toEqual([expect.objectContaining({ columns: [evidence.minimum] })])
      expect(layouts.every((layout) => !Object.hasOwn(layout, 'rows'))).toBe(true)

      if (zoom !== 1.25) {
        await dataCell.click()
        await page.keyboard.press('ControlOrMeta+z')
        expectedSaveCount += 1
        await expect.poll(saveCount).toBe(expectedSaveCount)
        await expect.poll(() => readLayoutWidths(table)).toEqual([120])
      }
    }

    await page.reload()
    const reopened = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
    )
    await expect(reopened).toBeVisible()
    await expect.poll(() => readLayoutWidths(reopened.locator('table.rv-office-table').first()))
      .toEqual(finalColumns)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

test('[slice 03.4] long content never raises or feeds back into the frozen square minimum', async ({ page }) => {
  test.setTimeout(90_000)
  const files = await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
  const fixture = files.find(
    ({ filename }: { filename: string }) => filename === 'Geometry-Long-Minimum.md',
  )
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const parsed = parseDocumentSettings(canonical.toString())
  fs.writeFileSync(fixture!.path, serializeDocumentSettings(
    parsed.body,
    parsed.settings,
    setDocumentTableStyles(parsed.frontmatter, [{
      tableIndex: 0,
      fingerprint: 'fixture-geometry-long',
      tableOverflow: 'newline',
    }]),
  ))
  const saveCount = await captureGeometrySaveMessages(page)

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const box = await table.boundingBox()
    if (!box) throw new Error('Long-content geometry table has no bounding box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const before = await readSquareMinimumEvidence(table)
    expect(before.outerHeight).toBeGreaterThan(before.minimum)
    await dragGeometryBoundary(page, 1, -10_000)
    await expect.poll(saveCount).toBe(1)

    const after = await readSquareMinimumEvidence(table)
    expect(after.minimum).toBe(before.minimum)
    expect(after.outerWidth).toBeCloseTo(before.minimum, 0)
    expect(after.outerHeight).toBeGreaterThan(after.minimum)
    expect(await readLayoutWidths(table)).toEqual([before.minimum, 360 - before.minimum])
    const firstCommit = fs.readFileSync(fixture!.path)

    await dragGeometryBoundary(page, 1, -500)
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(1)
    expect(fs.readFileSync(fixture!.path)).toEqual(firstCommit)
    expect((await readSquareMinimumEvidence(table)).minimum).toBe(before.minimum)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

test('[slice 03.4] rapid sequential drags keep preview writes outside the table and preserve the caret', async ({ page }) => {
  test.setTimeout(90_000)
  const files = await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Geometry-Three.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)
  const saveCount = await captureGeometrySaveMessages(page)
  await page.addInitScript(() => {
    const observed = window as typeof window & {
      __geometryMetadataCounters?: GeometryMetadataCounters
      __officeTableMetadataTestHook?: (event: string) => void
    }
    observed.__geometryMetadataCounters = { steps: 0, pluginPublications: 0, externalPublications: 0 }
    observed.__officeTableMetadataTestHook = (event) => {
      const counters = observed.__geometryMetadataCounters
      if (!counters) return
      if (event === 'step') counters.steps += 1
      if (event === 'plugin-publish') counters.pluginPublications += 1
      if (event === 'external-publish') counters.externalPublications += 1
    }
  })

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const caretCell = table.locator('td').first()
    await caretCell.click()
    await page.keyboard.press('Home')
    const selectionBefore = await page.evaluate(() => {
      const selection = document.getSelection()
      const element = selection?.anchorNode instanceof Element
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement
      return { cell: element?.closest('td,th')?.textContent, offset: selection?.anchorOffset }
    })
    await page.waitForTimeout(750)
    expect(await saveCount()).toBe(0)
    const bytesBefore = fs.readFileSync(fixture!.path)

    const tableBox = await table.boundingBox()
    if (!tableBox) throw new Error('Rapid-drag table has no bounding box')
    await page.mouse.move(tableBox.x + tableBox.width / 2, tableBox.y + tableBox.height / 2)
    const handle = page.locator('.rv-office-table-overlay .rv-office-col-grab').nth(1)
    const handleBox = await handle.boundingBox()
    if (!handleBox) throw new Error('Rapid-drag handle has no bounding box')
    await table.evaluate((element) => {
      const observed = window as typeof window & { __geometryTableMutations?: number }
      observed.__geometryTableMutations = 0
      const observer = new MutationObserver((records) => {
        observed.__geometryTableMutations = (observed.__geometryTableMutations ?? 0) + records.length
      })
      observer.observe(element, { attributes: true, childList: true, subtree: true })
      ;(window as typeof window & { __geometryTableObserver?: MutationObserver })
        .__geometryTableObserver = observer
    })
    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    for (const delta of [2, 4, 6, 8, 10]) await page.mouse.move(startX + delta, startY)
    expect(fs.readFileSync(fixture!.path)).toEqual(bytesBefore)
    expect(await readGeometryMetadataCounters(page)).toEqual({
      steps: 0,
      pluginPublications: 0,
      externalPublications: 0,
    })
    expect(await page.evaluate(() => (
      (window as typeof window & { __geometryTableMutations?: number }).__geometryTableMutations
    ))).toBe(0)
    await page.mouse.up()

    await dragGeometryBoundary(page, 1, -5)
    await dragGeometryBoundary(page, 2, 20)
    await expect.poll(() => readGeometryMetadataCounters(page)).toEqual({
      steps: 3,
      pluginPublications: 3,
      externalPublications: 3,
    })
    await expect.poll(saveCount).toBe(1)
    expect(await readLayoutWidths(table)).toEqual([125, 135, 100])
    expect((readGeometryLayouts(fixture!.path) as Array<Record<string, unknown>>)[0])
      .toEqual(expect.objectContaining({ columns: [125, 135, 100] }))
    const selectionAfter = await page.evaluate(() => {
      const selection = document.getSelection()
      const element = selection?.anchorNode instanceof Element
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement
      return { cell: element?.closest('td,th')?.textContent, offset: selection?.anchorOffset }
    })
    expect(selectionAfter).toEqual(selectionBefore)
    const mutationCount = await page.evaluate(() => (
      (window as typeof window & { __geometryTableMutations?: number }).__geometryTableMutations ?? 0
    ))
    expect(mutationCount).toBeGreaterThan(0)
    expect(mutationCount).toBeLessThanOrEqual(12)
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (
      (window as typeof window & { __geometryTableMutations?: number }).__geometryTableMutations ?? 0
    ))).toBe(mutationCount)
    await page.evaluate(() => {
      ;(window as typeof window & { __geometryTableObserver?: MutationObserver })
        .__geometryTableObserver?.disconnect()
    })
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

test('[slice 03.4] structure insert and delete followed by drag preserve colors and exact reopened widths', async ({ page }) => {
  test.setTimeout(120_000)
  const files = await resetOfficePlaywrightScenario({
    scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
  })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Structure-R3-C2.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const firstDataCell = table.locator('td').first()
    await firstDataCell.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert Column Right' }).click()
    await expect(table.locator(':scope > colgroup > col')).toHaveCount(3)
    await expect.poll(() => readLayoutWidths(table)).toEqual([90, 90, 110])
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([
      expect.objectContaining({ columns: [90, 90, 110] }),
    ])
    const afterInsertColors = (parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>).tableColors

    const insertedBox = await table.boundingBox()
    if (!insertedBox) throw new Error('Inserted structure table has no box')
    await page.mouse.move(insertedBox.x + insertedBox.width / 2, insertedBox.y + insertedBox.height / 2)
    await dragGeometryBoundary(page, 1, 10)
    await expect.poll(() => readLayoutWidths(table)).toEqual([100, 80, 110])
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([
      expect.objectContaining({ columns: [100, 80, 110] }),
    ])
    expect((parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>).tableColors).toEqual(afterInsertColors)

    await table.locator('td').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete Column Right' }).click()
    await expect(table.locator(':scope > colgroup > col')).toHaveCount(2)
    await expect.poll(() => readLayoutWidths(table)).toEqual([100, 110])
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([
      expect.objectContaining({ columns: [100, 110] }),
    ])
    const afterDeleteColors = (parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>).tableColors

    const deletedBox = await table.boundingBox()
    if (!deletedBox) throw new Error('Deleted structure table has no box')
    await page.mouse.move(deletedBox.x + deletedBox.width / 2, deletedBox.y + deletedBox.height / 2)
    await dragGeometryBoundary(page, 1, -10)
    await expect.poll(() => readLayoutWidths(table)).toEqual([90, 120])
    expect((parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>).tableColors).toEqual(afterDeleteColors)

    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([
      expect.objectContaining({ columns: [90, 120] }),
    ])
    const acceptedLayouts = readGeometryLayouts(fixture!.path)
    await page.reload()
    const reopened = page.locator(
      '.rv-office-document-editor .milkdown .ProseMirror[contenteditable="true"]',
    )
    await expect(reopened).toBeVisible()
    await expect.poll(() => readLayoutWidths(reopened.locator('table.rv-office-table').first()))
      .toEqual([90, 120])
    expect(readGeometryLayouts(fixture!.path)).toEqual(acceptedLayouts)
    expect((parseMarkdownFrontmatter(
      fs.readFileSync(fixture!.path, 'utf8'),
    ).frontmatter.metadata as Record<string, unknown>).tableColors).toEqual(afterDeleteColors)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({
      scenario: 'structure', variant: 'metadata', copies: 1, workspaces: 1,
    })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})

test('[slice 03.4] four-column outer drag persists exact geometry through genuine horizontal scrolling', async ({ page }) => {
  test.setTimeout(90_000)
  const files = await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
  const fixture = files.find(({ filename }: { filename: string }) => filename === 'Geometry-Four.md')
  expect(fixture).toBeTruthy()
  const canonical = fs.readFileSync(fixture!.path)

  try {
    const editor = await openGeometryDocument(page, fixture!.filename)
    const table = editor.locator('table.rv-office-table').first()
    const wrapper = table.locator('..')
    const scrollEvidence = await wrapper.evaluate((element) => {
      const scrollWrapper = element as HTMLElement
      scrollWrapper.style.width = '220px'
      scrollWrapper.style.overflowX = 'auto'
      scrollWrapper.scrollLeft = 75
      scrollWrapper.dispatchEvent(new Event('scroll'))
      return {
        clientWidth: scrollWrapper.clientWidth,
        scrollWidth: scrollWrapper.scrollWidth,
        scrollLeft: scrollWrapper.scrollLeft,
      }
    })
    expect(scrollEvidence.scrollWidth).toBeGreaterThan(scrollEvidence.clientWidth)
    expect(scrollEvidence.scrollLeft).toBeGreaterThan(0)
    const box = await table.boundingBox()
    if (!box) throw new Error('Scrolled four-column table has no box')
    await page.mouse.move(box.x + Math.min(box.width / 2, 180), box.y + box.height / 2)
    await expect(page.locator('.rv-office-table-overlay .rv-office-col-grab')).toHaveCount(5)
    await expect.poll(async () => maximumBoundaryError(await readBoundaryEvidence(page), 4))
      .toBeLessThanOrEqual(1)
    await dragGeometryBoundary(page, 4, 25)
    await expect.poll(() => readLayoutWidths(table)).toEqual([90, 110, 130, 175])
    await expect.poll(() => readGeometryLayouts(fixture!.path)).toEqual([
      expect.objectContaining({ columns: [90, 110, 130, 175] }),
    ])
    expect(await wrapper.evaluate((element) => (element as HTMLElement).scrollLeft)).toBeGreaterThan(0)
  } finally {
    await page.close()
    await resetOfficePlaywrightScenario({ scenario: 'geometry', copies: 1, workspaces: 1 })
    expect(fs.readFileSync(fixture!.path)).toEqual(canonical)
  }
})
