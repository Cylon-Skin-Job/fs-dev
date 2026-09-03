import path from 'node:path'
import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'

import {
  positionChildMenu,
  positionRootMenu,
} from '../src/components/menu/menuPositioning'

let harnessBundle: Promise<string> | null = null

function buildSharedMenuHarness(): Promise<string> {
  if (harnessBundle) return harnessBundle
  harnessBundle = (async () => {
    const virtualId = 'virtual:shared-menu-contract-harness'
    const resolvedVirtualId = `\0${virtualId}`
    const menuPath = path.resolve('src/components/menu/index.ts')
    const source = `
      import { openMenuTree } from ${JSON.stringify(menuPath)}

      let handle = null
      let outcome = { kind: 'stay' }
      let checked = false
      let asyncCalls = 0
      let resolveAsync = null
      let rejectAsync = null
      let externalMode = 'enabled'
      let ordinaryMode = 'enabled'
      const evidence = { restored: 0, postAction: 0, teardown: 0, reposition: 0 }

      const items = () => [{
        kind: 'heading', id: 'contract-heading', label: 'Contract heading',
      }, {
        kind: 'status', id: 'contract-status', label: 'Contract status',
      }, {
        kind: 'action', id: 'stay-root', label: 'Stay', icon: 'keep',
        onSelect: () => ({ kind: 'stay' }),
      }, {
        kind: 'action', id: 'outcome-root', label: 'Root outcome', icon: 'bolt',
        onSelect: () => outcome,
      }, {
        kind: 'submenu', id: 'level-one', label: 'Level one', icon: 'arrow_right', items: [{
          kind: 'submenu', id: 'level-two', label: 'Level two', icon: 'arrow_right', items: [{
            kind: 'radio', id: 'leaf', label: 'Leaf', checked,
            onSelect: () => outcome,
          }],
        }],
      }, {
        kind: 'action', id: 'first', label: 'First', icon: 'looks_one',
        onSelect: () => ({ kind: 'stay' }),
      }, {
        kind: 'action', id: 'middle', label: 'Middle', icon: 'more_horiz',
        onSelect: () => ({ kind: 'stay' }),
      }, {
        kind: 'action', id: 'previous', label: 'Previous', icon: 'arrow_upward',
        onSelect: () => ({ kind: 'stay' }),
      }, ...(ordinaryMode === 'removed' ? [] : [{
        kind: 'submenu', id: 'ordinary-owner', label: 'Owner', icon: 'arrow_right',
        disabled: ordinaryMode === 'disabled',
        items: [{
          kind: 'action', id: 'ordinary-leaf', label: 'Ordinary leaf', icon: 'done',
          onSelect: () => ({ kind: 'stay' }),
        }],
      }]), {
        kind: 'action', id: 'next', label: 'Next', icon: 'arrow_downward',
        onSelect: () => ({ kind: 'stay' }),
      }, {
        kind: 'action', id: 'async', label: 'Async', icon: 'hourglass',
        onSelect: () => {
          asyncCalls += 1
          return new Promise((resolve, reject) => { resolveAsync = resolve; rejectAsync = reject })
        },
      }, ...(externalMode === 'removed' ? [] : [{
        kind: 'external-child', id: 'external', label: 'External', icon: 'widgets', openOn: 'activate',
        disabled: externalMode === 'disabled',
        onOpen: (context) => {
          const surface = document.createElement('div')
          surface.id = 'shared-external-surface'
          const child = document.createElement('button')
          child.id = 'shared-external-child'
          child.textContent = 'External child menu'
          const retained = document.createElement('button')
          retained.id = 'shared-external-retained-action'
          retained.textContent = 'Retained external action'
          surface.append(child, retained)
          document.body.appendChild(surface)
          const registration = context.registerSurface(surface, {
            teardown: () => { evidence.teardown += 1; surface.remove() },
            reposition: (ownerElement) => {
              evidence.reposition += 1
              surface.dataset.ownerConnected = String(ownerElement.isConnected)
            },
          })
          child.addEventListener('click', () => registration?.openChildMenu({
            anchorElement: child,
            ariaLabel: 'External actions',
            items: [{
              kind: 'action', id: 'external-action', label: 'External action', icon: 'delete',
              onSelect: () => ({ kind: 'close-current' }),
            }],
          }))
          retained.addEventListener('click', () => {
            context.retainTreeOnNextAction()
            registration?.closeTree('action')
          })
        },
      }])]

      window.__sharedMenuHarness = {
        open(anchor = { kind: 'pointer', clientX: 20, clientY: 20 }) {
          handle?.close('replaced')
          evidence.restored = 0
          evidence.postAction = 0
          evidence.teardown = 0
          evidence.reposition = 0
          externalMode = 'enabled'
          ordinaryMode = 'enabled'
          asyncCalls = 0
          handle = openMenuTree({
            anchor,
            items: items(),
            ariaLabel: 'Contract menu',
            restoreInvocationFocus: () => {
              evidence.restored += 1
              document.querySelector('#invocation')?.focus()
            },
            focusAfterAction: () => {
              evidence.postAction += 1
              document.querySelector('#invocation')?.focus()
            },
          })
        },
        setOutcome(next) { outcome = next },
        update() { checked = !checked; handle?.update(items()) },
        setExternalMode(next) { externalMode = next; handle?.update(items()) },
        setOrdinaryMode(next) { ordinaryMode = next; handle?.update(items()) },
        focus(id) { return handle?.focusItem(id) ?? false },
        resolveAsync(next = { kind: 'stay' }) { resolveAsync?.(next) },
        rejectAsync() { rejectAsync?.(new Error('expected rejection')) },
        evidence() { return { ...evidence, asyncCalls, open: handle?.isOpen() ?? false } },
      }
    `
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'shared-menu-contract-harness',
        resolveId(id) { return id === virtualId ? resolvedVirtualId : null },
        load(id) { return id === resolvedVirtualId ? source : null },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: virtualId, output: { format: 'iife', name: 'SharedMenuContractHarness' } },
      },
    }) as { output: Array<{ type: string; code?: string }> }
    const chunk = result.output.find((item) => item.type === 'chunk' && item.code)
    if (!chunk?.code) throw new Error('Shared menu contract harness did not produce JavaScript')
    return chunk.code
  })()
  return harnessBundle
}

async function installHarness(page: Page) {
  const bundle = await buildSharedMenuHarness()
  const menuCss = await readFile(path.resolve('src/components/menu/MenuSurface.css'), 'utf8')
  await page.setContent(`
    <button id="invocation">Invocation</button>
    <button id="after-invocation">After invocation</button>
    <button id="outside">Outside</button>
    <style>
      ${menuCss}
      .rv-menu-surface { position: fixed; width: 220px; padding: 6px; }
      .rv-menu-item { display: block; width: 100%; min-height: 28px; }
      #shared-external-surface { position: fixed; left: 300px; top: 40px; }
    </style>
  `)
  await page.addScriptTag({ content: bundle })
}

test('all five outcomes retain distinct root and hierarchy semantics', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  const root = page.getByRole('menu', { name: 'Contract menu' })
  await root.getByRole('menuitem', { name: 'Stay' }).click()
  await expect(root).toBeVisible()

  await page.evaluate(() => (window as any).__sharedMenuHarness.setOutcome({ kind: 'back' }))
  await root.getByRole('menuitem', { name: 'Root outcome' }).click()
  await expect(root).toBeVisible()

  await page.evaluate(() => (window as any).__sharedMenuHarness.setOutcome({ kind: 'close-current' }))
  await root.getByRole('menuitem', { name: 'Root outcome' }).click()
  await expect(root).toHaveCount(0)

  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'Level one' }).press('ArrowRight')
  await page.getByRole('menuitem', { name: 'Level two' }).press('ArrowRight')
  await page.evaluate(() => (window as any).__sharedMenuHarness.setOutcome({ kind: 'back' }))
  await page.getByRole('menuitemradio', { name: 'Leaf' }).press('Enter')
  await expect(page.getByRole('menu', { name: 'Level two' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Level two' })).toBeFocused()

  await page.getByRole('menuitem', { name: 'Level two' }).press('ArrowRight')
  await page.evaluate(() => (window as any).__sharedMenuHarness.setOutcome({ kind: 'close-levels', count: 2 }))
  await page.getByRole('menuitemradio', { name: 'Leaf' }).press('Enter')
  await expect(page.getByRole('menu', { name: 'Level one' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Level one' })).toBeFocused()

  await page.getByRole('menuitem', { name: 'Level one' }).press('ArrowRight')
  await page.getByRole('menuitem', { name: 'Level two' }).press('ArrowRight')
  await page.evaluate(() => (window as any).__sharedMenuHarness.setOutcome({ kind: 'close-all' }))
  await page.getByRole('menuitemradio', { name: 'Leaf' }).press('Enter')
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect(page.locator('#invocation')).toBeFocused()
})

test('heading and status descriptors remain semantic, stable, and outside all interaction paths', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  const menu = page.getByRole('menu', { name: 'Contract menu' })
  const heading = menu.getByRole('heading', { name: 'Contract heading' })
  const status = menu.getByRole('status').filter({ hasText: 'Contract status' })

  await expect(heading).toHaveAttribute('data-menu-item-id', 'contract-heading')
  await expect(status).toHaveAttribute('data-menu-item-id', 'contract-status')
  await expect(heading).not.toHaveAttribute('tabindex', /.+/)
  await expect(status).not.toHaveAttribute('tabindex', /.+/)
  await expect(heading).not.toHaveAttribute('role', 'menuitem')
  await expect(status).not.toHaveAttribute('role', 'menuitem')
  await expect(menu.getByRole('menuitem', { name: 'Stay' })).toBeFocused()
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.focus('contract-heading'))).toBe(false)
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.focus('contract-status'))).toBe(false)

  await menu.getByRole('menuitem', { name: 'Stay' }).press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Root outcome' })).toBeFocused()
  await page.evaluate(() => (window as any).__sharedMenuHarness.update())
  await expect(menu.getByRole('menuitem', { name: 'Root outcome' })).toBeFocused()
})

test('updates preserve ancestry and focus; async actions are single-flight and rejection stays open', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'Level one' }).press('ArrowRight')
  await page.getByRole('menuitem', { name: 'Level two' }).press('ArrowRight')
  const leaf = page.getByRole('menuitemradio', { name: 'Leaf' })
  await expect(leaf).toBeFocused()
  await page.evaluate(() => (window as any).__sharedMenuHarness.update())
  await expect(leaf).toHaveAttribute('aria-checked', 'true')
  await expect(leaf).toBeFocused()

  await page.evaluate(() => (window as any).__sharedMenuHarness.focus('async'))
  const asyncItem = page.getByRole('menuitem', { name: 'Async' })
  await asyncItem.press('Enter')
  await asyncItem.evaluate((element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect(asyncItem).toHaveAttribute('aria-busy', 'true')
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.evidence().asyncCalls)).toBe(1)
  await page.evaluate(() => (window as any).__sharedMenuHarness.update())
  await expect(asyncItem).toHaveAttribute('aria-busy', 'true')
  await page.evaluate(() => (window as any).__sharedMenuHarness.rejectAsync())
  await expect(asyncItem).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('menu', { name: 'Contract menu' })).toBeVisible()

  await asyncItem.press('Enter')
  await expect(asyncItem).toHaveAttribute('aria-busy', 'true')
  await page.evaluate(() => (window as any).__sharedMenuHarness.update())
  await page.evaluate(() => (window as any).__sharedMenuHarness.resolveAsync({ kind: 'stay' }))
  await expect(asyncItem).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('menu', { name: 'Contract menu' })).toBeVisible()
})

test('an async outcome settling after replacement cannot affect the current tree or focus', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.evaluate(() => (window as any).__sharedMenuHarness.focus('async'))
  await page.getByRole('menuitem', { name: 'Async' }).press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Async' })).toHaveAttribute('aria-busy', 'true')

  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  const current = page.getByRole('menu', { name: 'Contract menu' })
  await expect(current).toHaveCount(1)
  await expect(current.getByRole('menuitem', { name: 'Stay' })).toBeFocused()
  await page.evaluate(() => (window as any).__sharedMenuHarness.resolveAsync({ kind: 'close-all' }))
  await expect(current).toHaveCount(1)
  await expect(current.getByRole('menuitem', { name: 'Stay' })).toBeFocused()
})

test('external surfaces share dismissal ownership, Escape tears down the tree, and Tab restores its origin', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'External' }).click()
  await page.locator('#shared-external-surface').click()
  await expect(page.getByRole('menu', { name: 'Contract menu' })).toBeVisible()
  await page.locator('#shared-external-retained-action').click()
  await expect(page.getByRole('menu', { name: 'Contract menu' })).toBeVisible()
  await expect(page.locator('#shared-external-surface')).toBeVisible()
  await page.locator('#shared-external-child').click()
  await expect(page.getByRole('menu', { name: 'External actions' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect(page.locator('#shared-external-surface')).toHaveCount(0)
  await expect(page.locator('#invocation')).toBeFocused()
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.evidence())).toMatchObject({
    restored: 1, teardown: 1, open: false,
  })

  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'Stay' }).press('Tab')
  await expect(page.getByRole('menu', { name: 'Contract menu' })).toHaveCount(0)
  await expect(page.locator('#after-invocation')).toBeFocused()
})

test('external registrations rebind stable owners and teardown invalid owners during updates', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'External' }).click()
  const externalSurface = page.locator('#shared-external-surface')
  await expect(externalSurface).toBeVisible()
  await page.locator('#shared-external-child').focus()

  await page.evaluate(() => (window as any).__sharedMenuHarness.update())
  await expect(externalSurface).toHaveAttribute('data-owner-connected', 'true')
  await expect(page.locator('#shared-external-child')).toBeFocused()
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.evidence())).toMatchObject({
    teardown: 0, reposition: 1, open: true,
  })

  await page.evaluate(() => (window as any).__sharedMenuHarness.setExternalMode('disabled'))
  await expect(externalSurface).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'External' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('menuitem', { name: 'Async' })).toBeFocused()
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.evidence().teardown)).toBe(1)

  await page.evaluate(() => (window as any).__sharedMenuHarness.setExternalMode('enabled'))
  await page.getByRole('menuitem', { name: 'External' }).click()
  await expect(externalSurface).toBeVisible()
  await page.locator('#shared-external-child').focus()
  await page.evaluate(() => (window as any).__sharedMenuHarness.setExternalMode('removed'))
  await expect(externalSurface).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Async' })).toBeFocused()
  expect(await page.evaluate(() => (window as any).__sharedMenuHarness.evidence().teardown)).toBe(2)
})

test('removing an ordinary submenu owner focuses the row that shifts into its logical slot', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'Owner' }).press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: 'Ordinary leaf' })).toBeFocused()

  await page.evaluate(() => (window as any).__sharedMenuHarness.setOrdinaryMode('removed'))

  await expect(page.getByRole('menu', { name: 'Owner' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Next' })).toBeFocused()
})

test('disabling an ordinary submenu owner focuses the preceding row on an equal-distance tie', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await page.getByRole('menuitem', { name: 'Owner' }).press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: 'Ordinary leaf' })).toBeFocused()

  await page.evaluate(() => (window as any).__sharedMenuHarness.setOrdinaryMode('disabled'))

  await expect(page.getByRole('menu', { name: 'Owner' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Owner' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('menuitem', { name: 'Previous' })).toBeFocused()
})

test('pure positioning clamps every root corner and flips a child before the right edge', () => {
  const viewport = { width: 800, height: 600 }
  const size = { width: 220, height: 180 }
  expect(positionRootMenu({ kind: 'pointer', clientX: -20, clientY: -10 }, size, viewport))
    .toEqual({ left: 8, top: 8 })
  expect(positionRootMenu({ kind: 'pointer', clientX: 799, clientY: 599 }, size, viewport))
    .toEqual({ left: 572, top: 412 })
  expect(positionChildMenu({ left: 700, right: 790, top: 560 }, size, viewport))
    .toEqual({ left: 476, top: 412 })
})

test('isolated menu CSS retains a semantic overlay fallback without workspace tokens', async ({ page }) => {
  await installHarness(page)
  await page.evaluate(() => (window as any).__sharedMenuHarness.open())
  await expect(page.getByRole('menu', { name: 'Contract menu' })).toHaveCSS('z-index', '1000')
})
