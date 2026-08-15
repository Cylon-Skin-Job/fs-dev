const TABLE_COLOR_BLOCK = [
  "  tableColors:",
  "    - tableIndex: 0",
  "      fingerprint: 'fixture-duplicate'",
  "      cells: { '0,0': '#ff0000', '1,1': '#00ff00', '2,2': '#0000ff' }",
  "      rows: { '1': { color: '#ffeeaa', rank: 4 }, '2': { color: '#aaddff', rank: 7 } }",
  "      columns: { '0': { color: '#ffccdd', rank: 3 }, '1': { color: '#ccffdd', rank: 7 } }",
  "    - tableIndex: 1",
  "      fingerprint: 'fixture-duplicate'",
  "      cells: { '0,1': '#663399', '1,0': '#008080', '2,2': '#ff8c00' }",
  "      rows: { '0': { color: '#f0e68c', rank: 5 } }",
  "      columns: { '2': { color: '#add8e6', rank: 5 } }",
]

const TABLE_LIFECYCLE_BLOCK = [
  '  tables:',
  "    - { tableIndex: 0, fingerprint: 'fixture-life-a', columns: [100, 140] }",
  "    - { tableIndex: 1, fingerprint: 'fixture-life-b', columns: [120, 160] }",
  "    - { tableIndex: 2, fingerprint: 'fixture-life-c', columns: [140, 180] }",
  '  tableColors:',
  "    - { tableIndex: 0, fingerprint: 'fixture-life-a', cells: { '0,0': '#aa0000' } }",
  "    - { tableIndex: 1, fingerprint: 'fixture-life-b', cells: { '0,0': '#00aa00' } }",
  "    - { tableIndex: 2, fingerprint: 'fixture-life-c', cells: { '0,0': '#0000aa' } }",
  '  tableStyles:',
  "    - { tableIndex: 0, fingerprint: 'fixture-life-a', fixtureSeed: 'keep-style-0' }",
  "    - { tableIndex: 1, fingerprint: 'fixture-life-b', fixtureSeed: 'keep-style-1' }",
  "    - { tableIndex: 2, fingerprint: 'fixture-life-c', fixtureSeed: 'keep-style-2' }",
]

const OVERFLOW_BLOCK = [
  '  tables:',
  "    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', columns: [96, 96] }",
  "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', columns: [96, 96] }",
  '  tableStyles:',
  "    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }",
]

const TITLE_ROW_DOCUMENT = [
  '---',
  "name: 'Title Row'",
  "description: 'Office E2E title-row/canonical'",
  'metadata:',
  "  fixtureScenario: 'title-row'",
  "  fixtureCase: 'canonical'",
  '  fixtureCopy: {{fixtureCopy}}',
  "  preserveUnknown: 'keep-me'",
  '  tables:',
  "    - { tableIndex: 0, fingerprint: 'fixture-title-ordinary', columns: [90, 110, 130] }",
  "    - { tableIndex: 1, fingerprint: 'fixture-title-valid', columns: [100, 120, 140] }",
  "    - { tableIndex: 4, fingerprint: 'fixture-title-two-row-stale', columns: [95, 115, 135] }",
  '  tableColors:',
  "    - { tableIndex: 0, fingerprint: 'fixture-title-ordinary', cells: { '0,0': '#d6ebff' } }",
  "    - { tableIndex: 1, fingerprint: 'fixture-title-valid', cells: { '0,0': '#ffeeaa' }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }",
  '  tableStyles:',
  "    - { tableIndex: 1, fingerprint: 'fixture-title-valid', titleRow: true, tableOverflow: 'newline', fixtureSeed: 'keep-title-valid' }",
  "    - { tableIndex: 3, fingerprint: 'fixture-title-stale', titleRow: true, tableOverflow: 'truncate', fixtureSeed: 'keep-title-stale' }",
  "    - { tableIndex: 4, fingerprint: 'fixture-title-two-row-stale', titleRow: true, tableOverflow: 'overflow', fixtureSeed: 'keep-title-two-row-stale' }",
  '---',
  'Before title-row.',
  '',
  '| ordinary-h0 | ordinary-h1 | ordinary-h2 |',
  '| --- | --- | --- |',
  '| ordinary-r1c0 | ordinary-r1c1 | ordinary-r1c2 |',
  '| ordinary-r2c0 | ordinary-r2c1 | ordinary-r2c2 |',
  '',
  '| Quarterly Results |  |  |',
  '| :--- | ---: | :---: |',
  '| Name | Q1 | Q2 |',
  '| Alpha | 10 | 20 |',
  '',
  '| one-column-h0 |',
  '| --- |',
  '| one-column-r1c0 |',
  '',
  '| Stale Title | KEEP ME |  |',
  '| --- | --- | --- |',
  '| stale-r1c0 | stale-r1c1 | stale-r1c2 |',
  '',
  '| Two Row Marked Title |  |  |',
  '| --- | --- | --- |',
  '| only-r1c0 | only-r1c1 | only-r1c2 |',
  '',
  'After title-row.',
]

export const TITLE_ROW_CANONICAL = `${TITLE_ROW_DOCUMENT.join('\n')
  .replace('{{fixtureCopy}}', '1')}\n`

const BORDER_TABLE_IDS = Object.freeze([
  'border-missing',
  'border-width-only',
  'border-color-only',
  'border-null-no-width',
  'border-null-width',
  'border-invalid-width',
  'border-invalid-color',
  'border-width-1',
  'border-width-2',
  'border-width-3',
  'border-width-4',
])

const BORDER_TABLE_BLOCKS = BORDER_TABLE_IDS.flatMap((id) => [
  `## ${id}`,
  '',
  `| ${id}-h0 | ${id}-h1 |`,
  '| --- | --- |',
  `| ${id}-r1c0 | ${id}-r1c1 |`,
])

const BORDERS_DOCUMENT = [
  '---',
  "name: '{{name}}'",
  "description: 'Office E2E borders/borders'",
  'metadata:',
  "  fixtureScenario: 'borders'",
  "  fixtureCase: 'borders'",
  '  fixtureCopy: {{fixtureCopy}}',
  "  preserveUnknown: 'keep-me'",
  '  tables:',
  "    - { tableIndex: 11, fingerprint: 'fixture-border-title', columns: [100, 120, 140], style: { fixtureLegacy: 'keep-border-title-layout' } }",
  '  tableColors:',
  "    - { tableIndex: 11, fingerprint: 'fixture-border-title', cells: { '0,0': '#ffeeaa' }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }",
  '  tableStyles:',
  "    - { tableIndex: 1, fingerprint: 'fixture-border-1', borderWidth: 2 }",
  "    - { tableIndex: 2, fingerprint: 'fixture-border-2', borderColor: '#004e89' }",
  "    - { tableIndex: 3, fingerprint: 'fixture-border-3', borderColor: null }",
  "    - { tableIndex: 4, fingerprint: 'fixture-border-4', borderWidth: 4, borderColor: null }",
  "    - { tableIndex: 5, fingerprint: 'fixture-border-5', borderWidth: 99, borderColor: '#004e89' }",
  "    - { tableIndex: 6, fingerprint: 'fixture-border-6', borderWidth: 2, borderColor: '#xyzxyz' }",
  "    - { tableIndex: 7, fingerprint: 'fixture-border-7', borderWidth: 1, borderColor: '#4a86e8' }",
  "    - { tableIndex: 8, fingerprint: 'fixture-border-8', borderWidth: 2, borderColor: '#4a86e8' }",
  "    - { tableIndex: 9, fingerprint: 'fixture-border-9', borderWidth: 3, borderColor: '#4a86e8' }",
  "    - { tableIndex: 10, fingerprint: 'fixture-border-10', borderWidth: 4, borderColor: '#4a86e8' }",
  "    - { tableIndex: 11, fingerprint: 'fixture-border-title', titleRow: true, tableOverflow: 'newline', tableAlignment: 'right', borderWidth: 4, borderColor: '#4a86e8', fixtureSeed: 'keep-border-title' }",
  '---',
  'Before borders.',
  '',
  ...BORDER_TABLE_BLOCKS.flatMap((line, index) => (
    index > 0 && line.startsWith('## ') ? ['', line] : [line]
  )),
  '',
  '## border-title',
  '',
  '| Border Title |  |  |',
  '| :--- | ---: | :---: |',
  '| border-title-h0 | border-title-h1 | border-title-h2 |',
  '| border-title-r1c0 | border-title-r1c1 | border-title-r1c2 |',
  '',
  'After borders.',
]

function renderBordersDocument(name, fixtureCopy) {
  return `${BORDERS_DOCUMENT.join('\n')
    .replace('{{name}}', name)
    .replace('{{fixtureCopy}}', String(fixtureCopy))}\n`
}

export const BORDERS_CANONICAL = renderBordersDocument('Borders', 1)

const ALIGNMENT_DOCUMENT = [
  '---',
  "name: '{{name}}'",
  "description: 'Office E2E alignment/alignment'",
  'metadata:',
  "  fixtureScenario: 'alignment'",
  "  fixtureCase: 'alignment'",
  '  fixtureCopy: {{fixtureCopy}}',
  "  preserveUnknown: 'keep-me'",
  '  tables:',
  "    - { tableIndex: 0, fingerprint: 'fixture-align-0', columns: [160, 160] }",
  "    - { tableIndex: 1, fingerprint: 'fixture-align-1', columns: [160, 160] }",
  "    - { tableIndex: 2, fingerprint: 'fixture-align-2', columns: [160, 160] }",
  "    - { tableIndex: 3, fingerprint: 'fixture-align-3', columns: [318, 318] }",
  "    - { tableIndex: 4, fingerprint: 'fixture-align-4', columns: [420, 420] }",
  "    - { tableIndex: 5, fingerprint: 'fixture-align-5', columns: [160, 160] }",
  '  tableStyles:',
  "    - { tableIndex: 0, fingerprint: 'fixture-align-0', tableAlignment: 'left' }",
  "    - { tableIndex: 1, fingerprint: 'fixture-align-1', tableAlignment: 'center' }",
  "    - { tableIndex: 2, fingerprint: 'fixture-align-2', tableAlignment: 'right' }",
  "    - { tableIndex: 3, fingerprint: 'fixture-align-3', tableAlignment: 'center' }",
  "    - { tableIndex: 4, fingerprint: 'fixture-align-4', tableAlignment: 'right' }",
  '---',
  'Before alignment.',
  '',
  '## align-left',
  '',
  '| align-left-h0 | align-left-h1 |',
  '| --- | --- |',
  '| align-left-r1c0 | align-left-r1c1 |',
  '',
  '## align-center',
  '',
  '| align-center-h0 | align-center-h1 |',
  '| --- | --- |',
  '| align-center-r1c0 | align-center-r1c1 |',
  '',
  '## align-right',
  '',
  '| align-right-h0 | align-right-h1 |',
  '| --- | --- |',
  '| align-right-r1c0 | align-right-r1c1 |',
  '',
  '## align-wrapper-width',
  '',
  '| align-wrapper-width-h0 | align-wrapper-width-h1 |',
  '| --- | --- |',
  '| align-wrapper-width-r1c0 | align-wrapper-width-r1c1 |',
  '',
  '## align-oversized',
  '',
  '| align-oversized-h0 | align-oversized-h1 |',
  '| --- | --- |',
  '| align-oversized-r1c0 | align-oversized-r1c1 |',
  '',
  '## align-keyless',
  '',
  '| align-keyless-h0 | align-keyless-h1 |',
  '| --- | --- |',
  '| align-keyless-r1c0 | align-keyless-r1c1 |',
  '',
  'After alignment.',
]

function renderAlignmentDocument(name, fixtureCopy) {
  return `${ALIGNMENT_DOCUMENT.join('\n')
    .replace('{{name}}', name)
    .replace('{{fixtureCopy}}', String(fixtureCopy))}\n`
}

export const ALIGNMENT_CANONICAL = renderAlignmentDocument('Alignment', 1)

const PRESENTATION_TITLE_KINDS = Object.freeze(['ordinary', 'title'])
const PRESENTATION_BORDER_KINDS = Object.freeze(['real', 'none'])
const PRESENTATION_WIDTHS = Object.freeze([1, 2, 3, 4])
const PRESENTATION_MODES = Object.freeze(['overflow', 'truncate', 'newline'])
const PRESENTATION_REAL_COLORS = Object.freeze({
  1: '#e11d48',
  2: '#16a34a',
  3: '#2563eb',
  4: '#9333ea',
})

function presentationOutputCases() {
  const cases = []
  for (const titleKind of PRESENTATION_TITLE_KINDS) {
    for (const borderKind of PRESENTATION_BORDER_KINDS) {
      for (const width of PRESENTATION_WIDTHS) {
        for (const mode of PRESENTATION_MODES) {
          const tableIndex = cases.length
          const id = `po-${titleKind}-${borderKind}-${width}px-${mode}`
          cases.push(Object.freeze({
            tableIndex,
            id,
            titleKind,
            borderKind,
            width,
            mode,
            fingerprint: `fixture-po-${String(tableIndex).padStart(2, '0')}`,
          }))
        }
      }
    }
  }
  return cases
}

const PRESENTATION_OUTPUT_CASES = Object.freeze(presentationOutputCases())

function renderPresentationOutputDocument(name, fixtureCopy) {
  const tableEntries = PRESENTATION_OUTPUT_CASES.map(({ tableIndex, fingerprint }) => (
    `    - { tableIndex: ${tableIndex}, fingerprint: '${fingerprint}', columns: [96, 96, 96] }`
  ))
  tableEntries.push("    - { tableIndex: 49, fingerprint: 'fixture-po-stale-title', columns: [96, 96, 96] }")
  const styleEntries = PRESENTATION_OUTPUT_CASES.map((entry) => {
    const title = entry.titleKind === 'title' ? 'titleRow: true, ' : ''
    const color = entry.borderKind === 'real'
      ? `'${PRESENTATION_REAL_COLORS[entry.width]}'`
      : 'null'
    return `    - { tableIndex: ${entry.tableIndex}, fingerprint: '${entry.fingerprint}', ${title}tableOverflow: '${entry.mode}', borderWidth: ${entry.width}, borderColor: ${color} }`
  })
  styleEntries.push("    - { tableIndex: 49, fingerprint: 'fixture-po-stale-title', titleRow: true, tableOverflow: 'truncate', borderWidth: 4, borderColor: '#004e89' }")

  const bodies = PRESENTATION_OUTPUT_CASES.map((entry) => {
    const header = entry.titleKind === 'title'
      ? `| Title ${entry.id} |  |  |\n| :--- | :---: | ---: |\n| Label | Break | Long |`
      : '| Label | Break | Long |\n| :--- | :---: | ---: |'
    return [
      `## ${entry.id}`,
      '',
      header,
      `| ${entry.id}-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |`,
    ].join('\n')
  })
  bodies.push([
    '## po-default-keyless',
    '',
    '| Label | Break | Long |',
    '| :--- | :---: | ---: |',
    '| po-default-keyless-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |',
  ].join('\n'))
  bodies.push([
    '## po-stale-title',
    '',
    '| Stale Title | KEEP ME |  |',
    '| :--- | :---: | ---: |',
    '| Label | Break | Long |',
    '| po-stale-title-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |',
  ].join('\n'))

  return [
    '---',
    `name: '${name}'`,
    "description: 'Office E2E presentation-output/matrix'",
    'metadata:',
    "  fixtureScenario: 'presentation-output'",
    "  fixtureCase: 'matrix'",
    `  fixtureCopy: ${fixtureCopy}`,
    "  preserveUnknown: 'keep-me'",
    '  tables:',
    ...tableEntries,
    '  tableStyles:',
    ...styleEntries,
    '---',
    'Before matrix.',
    '',
    bodies.join('\n\n'),
    '',
    'After matrix.',
    '',
  ].join('\n')
}

export const PRESENTATION_OUTPUT_CANONICAL = renderPresentationOutputDocument('Presentation Output', 1)

const STRUCTURE_METADATA = Object.freeze({
  'structure-r2-c1': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', columns: [80] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', cells: { '1,0': '#ffeeaa' } }",
  ]),
  'structure-r3-c2': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', columns: [90, 110] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', rows: { '1': { color: '#d6ebff', rank: 2 } }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }",
  ]),
  'structure-r5-c4': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', columns: [70, 90, 110, 130] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', cells: { '2,2': '#ffcccc' }, rows: { '3': { color: '#fff2cc', rank: 4 } }, columns: { '3': { color: '#e6ccff', rank: 5 } } }",
  ]),
})

const STRUCTURE_PARTIAL_WIDTHS = Object.freeze({
  'structure-r2-c1': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', columns: [80] }",
  ]),
  'structure-r3-c2': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', columns: [90] }",
  ]),
  'structure-r5-c4': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', columns: [70, 90] }",
  ]),
})

const STRUCTURE_RAW_METADATA = Object.freeze({
  'structure-r2-c1': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', columns: [null] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', cells: { '0,0': red, '9,9': '#112233' }, rows: malformed }",
  ]),
  'structure-r3-c2': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', columns: [90, null] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', cells: { '0,0': '#AABBCC', '1,1': red, '1,0': 42, '9,9': '#112233', malformed: '#334455' }, rows: { '0': { color: '#123456', rank: 3 }, '1': bad-shape, '2': { color: '#654321', rank: bad } }, columns: { '0': { color: '#fedcba', rank: 2 }, '-1': { color: '#111111', rank: 1 }, '1': null, '8': { color: '#333333', rank: 8 } }, future: keep-exact }",
  ]),
  'structure-r5-c4': Object.freeze([
    '  tables:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', columns: [70, null, bad, 130] }",
    '  tableColors:',
    "    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', cells: { malformed: 7 }, columns: malformed }",
  ]),
})

const table = (id, headerId, rows, columns, overrides = {}) => ({
  id,
  headerId,
  rows,
  columns,
  overrides,
})

const document = (
  fixtureCase,
  filename,
  workspace,
  tables,
  metadata = [],
  variantMetadata = {},
  canonicalRenderer = null,
) => ({
  fixtureCase,
  filename,
  workspace,
  tables,
  metadata,
  variantMetadata,
  canonicalRenderer,
})

const definitions = {
  basic: {
    documents: [
      document('basic', 'Basic Tables.md', 'a', [
        table('basic-a', 'basic-a', 2, 2),
        table('basic-b', 'basic-b', 2, 2),
      ]),
    ],
    variants: [],
  },
  structure: {
    documents: [
      document('structure-r2-c1', 'Structure-R2-C1.md', 'a', [table('structure-r2-c1', 'structure-r2-c1', 2, 1)], [], {
        metadata: STRUCTURE_METADATA['structure-r2-c1'],
        'partial-widths': STRUCTURE_PARTIAL_WIDTHS['structure-r2-c1'],
        'raw-metadata': STRUCTURE_RAW_METADATA['structure-r2-c1'],
      }),
      document('structure-r3-c2', 'Structure-R3-C2.md', 'a', [table('structure-r3-c2', 'structure-r3-c2', 3, 2)], [], {
        metadata: STRUCTURE_METADATA['structure-r3-c2'],
        'partial-widths': STRUCTURE_PARTIAL_WIDTHS['structure-r3-c2'],
        'raw-metadata': STRUCTURE_RAW_METADATA['structure-r3-c2'],
      }),
      document('structure-r5-c4', 'Structure-R5-C4.md', 'a', [table('structure-r5-c4', 'structure-r5-c4', 5, 4)], [], {
        metadata: STRUCTURE_METADATA['structure-r5-c4'],
        'partial-widths': STRUCTURE_PARTIAL_WIDTHS['structure-r5-c4'],
        'raw-metadata': STRUCTURE_RAW_METADATA['structure-r5-c4'],
      }),
    ],
    variants: ['metadata', 'partial-widths', 'raw-metadata'],
  },
  'color-integrity': {
    documents: [
      document('color-integrity', 'Color Integrity.md', 'a', [
        table('color-a', 'duplicate-header', 3, 3),
        table('color-b', 'duplicate-header', 3, 3),
      ], TABLE_COLOR_BLOCK),
    ],
    variants: [],
  },
  geometry: {
    documents: [
      document('geometry-one', 'Geometry-One.md', 'a', [table('geometry-one', 'geometry-one', 2, 1)], [
        '  tables:',
        "    - tableIndex: 0",
        "      fingerprint: 'fixture-geometry-one'",
        '      columns: [120]',
      ]),
      document('geometry-three', 'Geometry-Three.md', 'a', [table('geometry-three', 'geometry-three', 3, 3)], [
        '  tables:',
        '    - tableIndex: 0',
        "      fingerprint: 'fixture-geometry-three'",
        '      columns: [120, 120, 120]',
      ]),
      document('geometry-four', 'Geometry-Four.md', 'a', [table('geometry-four', 'geometry-four', 3, 4)], [
        '  tables:',
        '    - tableIndex: 0',
        "      fingerprint: 'fixture-geometry-four'",
        '      columns: [90, 110, 130, 150]',
      ]),
      document('geometry-long', 'Geometry-Long-Minimum.md', 'a', [
        table('geometry-long', 'geometry-long', 2, 2, {
          'r1c0': 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
        }),
      ], [
        '  tables:',
        '    - tableIndex: 0',
        "      fingerprint: 'fixture-geometry-long'",
        '      columns: [180, 180]',
      ]),
      document('geometry-keyless', 'Geometry-Keyless.md', 'a', [table('geometry-keyless', 'geometry-keyless', 2, 3)]),
    ],
    variants: [],
  },
  palette: {
    documents: [
      document('palette-a', 'Palette-A.md', 'a', [table('palette-a', 'palette-a', 2, 2)]),
      document('palette-b', 'Palette-B.md', 'b', [table('palette-b', 'palette-b', 2, 2)]),
      document('palette-c', 'Palette-C.md', 'c', [table('palette-c', 'palette-c', 2, 2)]),
    ],
    variants: PALETTE_SELECTOR_VARIANTS,
  },
  'table-lifecycle': {
    documents: [
      document('table-lifecycle', 'Table Lifecycle.md', 'a', [
        table('life-a', 'life-a', 2, 2),
        table('life-b', 'life-b', 3, 2),
        table('life-c', 'life-c', 2, 2),
      ], TABLE_LIFECYCLE_BLOCK),
    ],
    variants: [],
  },
  overflow: {
    documents: [
      document('overflow', 'Overflow.md', 'a', [
        table('overflow-a', 'overflow-a', 2, 2, {
          'r1c0': 'FirstLineSegmentABCDEFGHIJ<br>SecondLineSegmentKLMNOPQRST',
        }),
        table('overflow-b', 'overflow-b', 2, 2, {
          'r1c1': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        }),
      ], OVERFLOW_BLOCK),
    ],
    variants: [],
  },
  'title-row': {
    documents: [
      document('canonical', 'Title Row.md', 'a', [], [], {}, 'title-row'),
    ],
    variants: [],
  },
  borders: {
    documents: [
      document('borders', 'Borders.md', 'a', [], [], {}, 'borders'),
    ],
    variants: [],
  },
  alignment: {
    documents: [
      document('alignment', 'Alignment.md', 'a', [], [], {}, 'alignment'),
    ],
    variants: [],
  },
  'presentation-output': {
    documents: [
      document('matrix', 'Presentation Output.md', 'a', [], [], {}, 'presentation-output'),
    ],
    variants: [],
  },
}

const fullTemplate = (sourceScenario, template) => ({ ...template, sourceScenario })

definitions.full = {
  documents: [
    ...definitions.structure.documents.map((template) => fullTemplate('structure', template)),
    ...definitions['color-integrity'].documents.map((template) => fullTemplate('color-integrity', template)),
    ...definitions.geometry.documents.map((template) => fullTemplate('geometry', template)),
    ...definitions['table-lifecycle'].documents.map((template) => fullTemplate('table-lifecycle', template)),
    ...definitions.overflow.documents.map((template) => fullTemplate('overflow', template)),
    ...definitions['title-row'].documents.map((template) => fullTemplate('title-row', template)),
    ...definitions.borders.documents.map((template) => fullTemplate('borders', template)),
    ...definitions.alignment.documents.map((template) => fullTemplate('alignment', template)),
    ...definitions['presentation-output'].documents.map((template) => fullTemplate('presentation-output', template)),
    ...definitions.palette.documents.map((template) => fullTemplate('palette', template)),
  ],
  variants: [],
  paletteVariant: 'local-selected',
  requiredWorkspaces: 3,
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export const FIXTURE_SCENARIOS = deepFreeze(definitions)
export const FIXTURE_SCENARIO_IDS = Object.freeze(Object.keys(FIXTURE_SCENARIOS))

export function getFixtureScenario(id) {
  const scenario = FIXTURE_SCENARIOS[id]
  if (!scenario) throw new Error(`Unknown Office fixture scenario: ${id}`)
  return scenario
}

export function copyFilename(filename, copy, copies) {
  if (copies === 1) return filename
  const stem = filename.slice(0, -3)
  return `${stem}--copy-${String(copy).padStart(2, '0')}.md`
}

function markdownRow(cells) {
  return `| ${cells.join(' | ')} |`
}

function renderTable(descriptor) {
  const lines = [`## ${descriptor.id}`, '']
  lines.push(markdownRow(Array.from({ length: descriptor.columns }, (_, column) => `${descriptor.headerId}-h${column}`)))
  lines.push(markdownRow(Array.from({ length: descriptor.columns }, () => '---')))
  for (let row = 1; row < descriptor.rows; row += 1) {
    lines.push(markdownRow(Array.from({ length: descriptor.columns }, (_, column) => {
      const coordinate = `r${row}c${column}`
      return descriptor.overrides[coordinate] ?? `${descriptor.id}-${coordinate}`
    })))
  }
  return lines.join('\n')
}

export function renderFixtureDocument(scenarioId, template, copy = 1, copies = 1, variant = null) {
  if (!Number.isInteger(copy) || !Number.isInteger(copies) || copies < 1 || copies > 32 || copy < 1 || copy > copies) {
    throw new Error('Fixture copy values must be integers with 1 <= copy <= copies <= 32')
  }
  const filename = copyFilename(template.filename, copy, copies)
  const sourceScenario = template.sourceScenario ?? scenarioId
  if (template.canonicalRenderer === 'title-row') {
    const rendered = TITLE_ROW_CANONICAL.replace('  fixtureCopy: 1\n', `  fixtureCopy: ${copy}\n`)
    return scenarioId === 'full'
      ? rendered.replace("name: 'Title Row'\n", `name: '${filename.slice(0, -3)}'\n`)
      : rendered
  }
  if (template.canonicalRenderer === 'borders') {
    return renderBordersDocument(filename.slice(0, -3), copy)
  }
  if (template.canonicalRenderer === 'alignment') {
    return renderAlignmentDocument(filename.slice(0, -3), copy)
  }
  if (template.canonicalRenderer === 'presentation-output') {
    return renderPresentationOutputDocument(filename.slice(0, -3), copy)
  }
  const name = filename.slice(0, -3)
  const selectedVariantMetadata = variant === null ? [] : template.variantMetadata?.[variant] ?? []
  const lines = [
    '---',
    `name: '${name}'`,
    `description: 'Office E2E ${sourceScenario}/${template.fixtureCase}'`,
    'metadata:',
    `  fixtureScenario: '${sourceScenario}'`,
    `  fixtureCase: '${template.fixtureCase}'`,
    `  fixtureCopy: ${copy}`,
    "  preserveUnknown: 'keep-me'",
    ...template.metadata,
    ...selectedVariantMetadata,
    '---',
    `Before ${template.fixtureCase}.`,
    '',
    template.tables.map(renderTable).join('\n\n'),
    '',
    `After ${template.fixtureCase}.`,
  ]
  return `${lines.join('\n')}\n`
}
import { PALETTE_SELECTOR_VARIANTS } from './palette-selector-fixtures.mjs'
