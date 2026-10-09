import fs from 'node:fs'
import path from 'node:path'

export const OFFICE_E2E_OTHER_MACHINE = 'Office-E2E-Other'
export const PALETTE_SELECTOR_VARIANTS = Object.freeze([
  'global-selected',
  'local-selected',
  'selected-mutations',
  'toggle-selector',
  'workspace-cycle',
  'machine-move',
  'selected-source-errors',
  'shutdown-cleanup',
])

export function canonicalLocalPalette(colors, syncEnabled) {
  return `${JSON.stringify({ custom_colors: colors, sync_enabled: syncEnabled }, null, 2)}\n`
}

export function canonicalGlobalPalette(colors) {
  return `${JSON.stringify({ custom_colors: colors }, null, 2)}\n`
}

const falseLocals = Object.freeze({
  a: canonicalLocalPalette(['#aa0001'], false),
  b: canonicalLocalPalette(['#00bb02'], false),
  c: canonicalLocalPalette(['#000cc3'], false),
})

const trueA = Object.freeze({
  ...falseLocals,
  a: canonicalLocalPalette(['#aa0001'], true),
})

export const PALETTE_SELECTOR_SEEDS = Object.freeze({
  'global-selected': Object.freeze({
    local: Object.freeze({
      ...trueA,
      b: canonicalLocalPalette(['#00bb02'], true),
    }),
    global: canonicalGlobalPalette(['#112233', '#445566']),
  }),
  'local-selected': Object.freeze({
    local: falseLocals,
    global: canonicalGlobalPalette(['#112233', '#445566']),
  }),
  'selected-mutations': Object.freeze({
    local: Object.freeze({
      ...falseLocals,
      a: canonicalLocalPalette(['#aa0001', '#aa0002'], false),
    }),
    global: canonicalGlobalPalette(['#112233', '#445566']),
  }),
  'toggle-selector': Object.freeze({
    local: falseLocals,
    global: canonicalGlobalPalette(['#112233', '#445566']),
  }),
  'workspace-cycle': Object.freeze({
    local: Object.freeze({
      a: canonicalLocalPalette(['#aa0001'], true),
      b: canonicalLocalPalette(['#00bb02'], false),
      c: canonicalLocalPalette(['#000cc3'], true),
    }),
    global: canonicalGlobalPalette(['#112233']),
  }),
  'machine-move': Object.freeze({
    local: trueA,
    global: canonicalGlobalPalette(['#112233']),
    otherMachineLocal: Object.freeze({
      a: canonicalLocalPalette(['#abcdef'], true),
      b: canonicalLocalPalette(['#bcdef0'], false),
      c: canonicalLocalPalette(['#cdef01'], false),
    }),
    otherMachineGlobal: canonicalGlobalPalette(['#778899']),
  }),
  'selected-source-errors': Object.freeze({
    local: trueA,
    global: '{"custom_colors":[',
  }),
  'shutdown-cleanup': Object.freeze({
    local: trueA,
    global: canonicalGlobalPalette(['#112233']),
  }),
})

export function localPalettePath(workspaceRoot, machineName) {
  return path.join(workspaceRoot, 'ai', machineName, 'System', 'config', 'colors.json')
}

export function globalPalettePath(appUserData) {
  return path.join(
    appUserData,
    'System_Manager',
    'global-configs',
    'office-custom-color-pallete',
    'colors.json',
  )
}

function replaceOwnedFile(candidate, bytes, assertOwned) {
  assertOwned(candidate)
  fs.rmSync(candidate, { force: true })
  if (bytes === null) return
  fs.mkdirSync(path.dirname(candidate), { recursive: true })
  fs.writeFileSync(candidate, bytes, { flag: 'w' })
}

export function resetPaletteSelectorFixture(options) {
  const { appUserData, assertOwned, machineName, variant, workspaceRoots } = options
  const seed = PALETTE_SELECTOR_SEEDS[variant]
  if (!seed) throw new Error(`Unknown Office fixture palette variant: ${variant}`)
  const files = []
  for (const [suffix, workspaceRoot] of Object.entries(workspaceRoots)) {
    const local = localPalettePath(workspaceRoot, machineName)
    const other = localPalettePath(workspaceRoot, OFFICE_E2E_OTHER_MACHINE)
    replaceOwnedFile(local, seed.local[suffix], assertOwned)
    replaceOwnedFile(other, seed.otherMachineLocal?.[suffix] ?? null, assertOwned)
    files.push(Object.freeze({ kind: 'local', machineName, path: local, suffix }))
    if (seed.otherMachineLocal) {
      files.push(Object.freeze({
        kind: 'local',
        machineName: OFFICE_E2E_OTHER_MACHINE,
        path: other,
        suffix,
      }))
    }
  }
  const global = globalPalettePath(appUserData)
  replaceOwnedFile(global, seed.global, assertOwned)
  files.push(Object.freeze({ kind: 'global', machineName, path: global }))
  return Object.freeze(files)
}
