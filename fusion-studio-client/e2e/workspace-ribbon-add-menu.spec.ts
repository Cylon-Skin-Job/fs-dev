import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
import { build } from 'vite'

interface WorkspaceRibbonMessage {
  type?: string
  workspaceId?: string
}

interface WorkspaceRibbonAddHarness {
  mount: () => void
  setRibbonOpen: (open: boolean) => void
  replace: () => void
  unmount: () => void
  evidence: () => {
    closeRibbon: number
    addProject: number
    createNew: number
    addToRibbon: string[]
  }
}

declare global {
  interface Window {
    __workspaceRibbonMessages: WorkspaceRibbonMessage[]
    __workspaceRibbonAddHarness: WorkspaceRibbonAddHarness
  }
}

const WORKSPACES = [
  { id: 'office-e2e-a', label: 'Office E2E A', icon: 'description' },
  { id: 'office-e2e-b', label: 'Office E2E B', icon: 'description' },
  { id: 'office-e2e-c', label: 'Office E2E C', icon: 'description' },
] as const

async function openWorkspace(page: Page) {
  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toBeVisible()
}

async function openRibbon(page: Page) {
  const ribbon = page.locator('.rv-workspace-ribbon')
  if (await ribbon.getAttribute('aria-hidden') === 'true') {
    await page.getByTitle('Switch workspace', { exact: true }).click()
  }
  await expect(ribbon).toHaveClass(/is-open/)
  return ribbon
}

function ribbonItem(page: Page, workspaceId: string) {
  return page.locator(`.rv-workspace-ribbon-item[data-workspace-id="${workspaceId}"]`)
}

async function openAddMenu(page: Page) {
  await openRibbon(page)
  const trigger = page.getByTitle('Add to ribbon', { exact: true })
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  const menu = page.getByRole('menu', { name: 'Add workspace to ribbon', exact: true })
  await expect(menu).toBeVisible()
  return { menu, trigger }
}

async function ensureAllWorkspacesVisible(page: Page) {
  await openRibbon(page)
  for (const workspace of WORKSPACES) {
    const item = ribbonItem(page, workspace.id)
    if (await item.count()) continue
    const { menu } = await openAddMenu(page)
    await menu.getByRole('menuitem', { name: workspace.label, exact: true }).click()
    await expect(item).toBeVisible()
  }
}

async function hideWorkspace(page: Page, workspaceId: string) {
  await openRibbon(page)
  const item = ribbonItem(page, workspaceId)
  if (await item.count() === 0) return
  await item.getByRole('button', { name: 'Remove from ribbon' }).click()
  await expect(item).toHaveCount(0)
}

async function expectInsideViewport(page: Page, menu: Locator) {
  const box = await menu.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(8)
  expect(box!.y).toBeGreaterThanOrEqual(8)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width - 8)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height - 8)
}

async function computedValue(locator: Locator, property: string) {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

async function resolveBackground(page: Page, value: string) {
  return page.evaluate((candidate) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = candidate
    document.body.append(probe)
    const result = getComputedStyle(probe).backgroundColor
    probe.remove()
    return result
  }, value)
}

async function replaceWorkspaceLabelOnRegistryChange(page: Page, workspaceId: string, label: string) {
  const evidence = { routed: false, registryChangeMutated: false }
  let mutateRegistryChanges = true
  await page.context().routeWebSocket(/.*/, (socket) => {
    evidence.routed = true
    const server = socket.connectToServer()
    socket.onMessage((payload) => server.send(payload))
    server.onMessage((payload) => {
      const text = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf8')
      try {
        const message = JSON.parse(text)
        if (
          mutateRegistryChanges
          && message.type === 'workspace:registry_changed'
          && Array.isArray(message.workspaces)
        ) {
          message.workspaces = message.workspaces.map((workspace: { id?: string; label?: string }) => (
            workspace.id === workspaceId ? { ...workspace, label } : workspace
          ))
          evidence.registryChangeMutated = true
          socket.send(JSON.stringify(message))
          return
        }
      } catch {
        // Preserve malformed/non-JSON traffic for the application handler.
      }
      socket.send(payload)
    })
  })
  return {
    evidence,
    stop: () => { mutateRegistryChanges = false },
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const originalSend = WebSocket.prototype.send
    window.__workspaceRibbonMessages = []
    WebSocket.prototype.send = function instrumentedSend(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (typeof data === 'string') {
        try {
          window.__workspaceRibbonMessages.push(JSON.parse(data))
        } catch {
          // Preserve non-JSON traffic without treating it as Ribbon evidence.
        }
      }
      return originalSend.call(this, data)
    }
  })
})

test('zero-hidden state keeps heading/status semantic and roving focus on actions only', async ({ page }) => {
  await openWorkspace(page)
  await ensureAllWorkspacesVisible(page)
  const { menu, trigger } = await openAddMenu(page)
  const heading = menu.getByRole('heading', { name: 'Add to ribbon', exact: true })
  const status = menu.getByRole('status').filter({ hasText: 'No hidden workspaces' })
  const addProject = menu.getByRole('menuitem', { name: 'Add Project', exact: true })
  const createNew = menu.getByRole('menuitem', { name: 'Create New', exact: true })

  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toHaveClass(/rv-interaction-context/)
  await expect(heading).toHaveAttribute('data-menu-item-id', 'workspace-ribbon-add-heading')
  await expect(status).toHaveAttribute('data-menu-item-id', 'workspace-ribbon-add-empty')
  await expect(heading).not.toHaveAttribute('tabindex', /.+/)
  await expect(status).not.toHaveAttribute('tabindex', /.+/)
  await expect(menu.getByRole('menuitem')).toHaveCount(2)
  await expect(addProject).toBeFocused()
  await addProject.press('ArrowDown')
  await expect(createNew).toBeFocused()
  await createNew.press('ArrowDown')
  await expect(addProject).toBeFocused()
  await addProject.press('End')
  await expect(createNew).toBeFocused()
  await createNew.press('Home')
  await expect(addProject).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('hidden workspaces preserve exact icon/order/grouping and add once with Enter or Space', async ({ page }) => {
  await openWorkspace(page)
  await ensureAllWorkspacesVisible(page)
  await hideWorkspace(page, 'office-e2e-c')
  await hideWorkspace(page, 'office-e2e-b')
  await page.evaluate(() => { window.__workspaceRibbonMessages = [] })

  let { menu, trigger } = await openAddMenu(page)
  const rows = menu.getByRole('menuitem')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toHaveText(/Office E2E B/)
  await expect(rows.nth(1)).toHaveText(/Office E2E C/)
  await expect(rows.nth(2)).toHaveText(/Add Project/)
  await expect(rows.nth(3)).toHaveText(/Create New/)
  await expect(rows.nth(0).locator('.rv-menu-item-icon')).toHaveText('description')
  await expect(rows.nth(1).locator('.rv-menu-item-icon')).toHaveText('description')
  expect(await menu.locator(':scope > *').evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('role') || element.className
  )))).toEqual(['heading', 'menuitem', 'menuitem', 'separator', 'menuitem', 'menuitem'])
  await expect(rows.nth(0)).toBeFocused()
  await rows.nth(0).press('Enter')
  await expect(ribbonItem(page, 'office-e2e-b')).toBeVisible()
  await expect(trigger).toBeFocused()

  ;({ menu, trigger } = await openAddMenu(page))
  const remaining = menu.getByRole('menuitem', { name: 'Office E2E C', exact: true })
  await expect(remaining).toBeFocused()
  await remaining.press('Space')
  await expect(ribbonItem(page, 'office-e2e-c')).toBeVisible()
  await expect(trigger).toBeFocused()
  const messages = await page.evaluate(() => window.__workspaceRibbonMessages)
  expect(messages.filter((message) => message.type === 'workspace:ribbon_add_requested')).toEqual([
    { type: 'workspace:ribbon_add_requested', workspaceId: 'office-e2e-b' },
    { type: 'workspace:ribbon_add_requested', workspaceId: 'office-e2e-c' },
  ])
})

test('Add Project and Create New keep their current modal results and close the Ribbon', async ({ page }) => {
  await openWorkspace(page)
  await ensureAllWorkspacesVisible(page)
  let { menu } = await openAddMenu(page)
  await menu.getByRole('menuitem', { name: 'Add Project', exact: true }).press('Enter')
  const addDialog = page.getByRole('dialog', { name: 'Add Project', exact: true })
  await expect(addDialog).toBeVisible()
  await expect(addDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await expect(page.locator('.rv-workspace-ribbon')).not.toHaveClass(/is-open/)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Add Project', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true }).click()

  ;({ menu } = await openAddMenu(page))
  const addProject = menu.getByRole('menuitem', { name: 'Add Project', exact: true })
  await addProject.press('ArrowDown')
  await menu.getByRole('menuitem', { name: 'Create New', exact: true }).press('Space')
  const createDialog = page.getByRole('dialog', { name: 'Create New Project', exact: true })
  await expect(createDialog).toBeVisible()
  await expect(createDialog.getByRole('textbox', { name: 'Project folder path' })).toBeFocused()
  await expect(page.locator('.rv-workspace-ribbon')).not.toHaveClass(/is-open/)
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel create project' }).click()
})

test('Escape, Tab, trigger, outside pointer, and scrim closure leave no stale menu', async ({ page }) => {
  await openWorkspace(page)
  await ensureAllWorkspacesVisible(page)
  let { menu, trigger } = await openAddMenu(page)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  ;({ menu, trigger } = await openAddMenu(page))
  await menu.getByRole('menuitem', { name: 'Add Project', exact: true }).press('Tab')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => document.activeElement?.classList.contains('rv-menu-item'))).toBe(false)

  ;({ menu, trigger } = await openAddMenu(page))
  await trigger.click()
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  ;({ menu, trigger } = await openAddMenu(page))
  await page.locator('.rv-workspace-ribbon').click({ position: { x: 2, y: 2 } })
  await expect(menu).toHaveCount(0)
  await expect(page.locator('.rv-workspace-ribbon')).toHaveClass(/is-open/)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  ;({ menu } = await openAddMenu(page))
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  await page.mouse.click(4, viewport!.height - 4)
  await expect(menu).toHaveCount(0)
  await expect(page.locator('.rv-workspace-ribbon')).not.toHaveClass(/is-open/)
})

test('the element-anchored menu clamps every corner above the Ribbon overlay', async ({ page }) => {
  const longWorkspaceLabel = `Workspace${'X'.repeat(120)}`
  const labelRoute = await replaceWorkspaceLabelOnRegistryChange(page, 'office-e2e-b', longWorkspaceLabel)
  await openWorkspace(page)
  expect(labelRoute.evidence).toEqual({ routed: true, registryChangeMutated: false })
  await ensureAllWorkspacesVisible(page)
  await hideWorkspace(page, 'office-e2e-b')
  await expect.poll(() => labelRoute.evidence.registryChangeMutated).toBe(true)
  const trigger = page.getByTitle('Add to ribbon', { exact: true })
  const initialViewport = page.viewportSize()
  expect(initialViewport).not.toBeNull()
  const originalStyle = await trigger.getAttribute('style')
  for (const horizontal of ['left', 'right'] as const) {
    for (const vertical of ['top', 'bottom'] as const) {
      await trigger.evaluate((element, position) => {
        const target = element as HTMLElement
        target.style.position = 'fixed'
        target.style.zIndex = '2005'
        target.style.left = position.horizontal === 'left' ? '1px' : 'auto'
        target.style.right = position.horizontal === 'right' ? '1px' : 'auto'
        target.style.top = position.vertical === 'top' ? '1px' : 'auto'
        target.style.bottom = position.vertical === 'bottom' ? '1px' : 'auto'
      }, { horizontal, vertical })
      await trigger.click()
      const menu = page.getByRole('menu', { name: 'Add workspace to ribbon', exact: true })
      await expectInsideViewport(page, menu)
      expect(Number(await computedValue(menu, 'z-index'))).toBeGreaterThan(
        Number(await computedValue(page.locator('.rv-workspace-ribbon'), 'z-index')),
      )
      await page.keyboard.press('Escape')
    }
  }
  await trigger.evaluate((element, style) => {
    if (style === null) element.removeAttribute('style')
    else element.setAttribute('style', style)
  }, originalStyle)

  await page.setViewportSize({ width: 300, height: 600 })
  await trigger.click()
  const narrowMenu = page.getByRole('menu', { name: 'Add workspace to ribbon', exact: true })
  await expectInsideViewport(page, narrowMenu)
  await expect(narrowMenu).toHaveCSS('max-width', '284px')
  const longRow = narrowMenu.locator('[data-menu-item-id="workspace-ribbon-add-office-e2e-b"]')
  const longLabel = longRow.locator('.rv-menu-item-label')
  await expect(longLabel).toHaveText(longWorkspaceLabel)
  await expect(longLabel).toHaveCSS('overflow', 'hidden')
  await expect(longLabel).toHaveCSS('text-overflow', 'ellipsis')
  await expect(longLabel).toHaveCSS('white-space', 'nowrap')
  const overflow = await longRow.evaluate((item) => {
    const surface = item.closest<HTMLElement>('.rv-menu-surface')
    if (!surface) throw new Error('Menu surface missing for hidden-workspace row')
    const label = item.querySelector<HTMLElement>('.rv-menu-item-label')
    return {
      surfaceClientWidth: surface.clientWidth,
      surfaceScrollWidth: surface.scrollWidth,
      rowClientWidth: item.clientWidth,
      rowScrollWidth: item.scrollWidth,
      labelClientWidth: label?.clientWidth ?? -1,
      labelScrollWidth: label?.scrollWidth ?? -1,
    }
  })
  expect(overflow.surfaceScrollWidth).toBeLessThanOrEqual(overflow.surfaceClientWidth)
  expect(overflow.rowScrollWidth).toBeLessThanOrEqual(overflow.rowClientWidth)
  expect(overflow.labelScrollWidth).toBeGreaterThan(overflow.labelClientWidth)
  await page.keyboard.press('Escape')
  await page.setViewportSize(initialViewport!)
  labelRoute.stop()
})

test('dark/light hover, pressed, and focus layers derive from the effective menu surface', async ({ page }) => {
  await openWorkspace(page)
  await ensureAllWorkspacesVisible(page)
  for (const tokens of [
    { surface: '#20242a', contrast: '#ffffff' },
    { surface: '#e4e7eb', contrast: '#000000' },
  ]) {
    await page.evaluate(({ surface, contrast }) => {
      document.documentElement.style.setProperty('--rv-menu-surface-bg', surface)
      document.documentElement.style.setProperty('--interactive-contrast-foreground', contrast)
      document.documentElement.style.setProperty(
        '--interactive-focus-ring',
        'color-mix(in srgb, var(--interactive-contrast-foreground) 75%, transparent)',
      )
    }, tokens)
    const { menu } = await openAddMenu(page)
    const item = menu.getByRole('menuitem', { name: 'Add Project', exact: true })
    const expectedSurface = await resolveBackground(page, tokens.surface)
    const expectedHover = await resolveBackground(
      page,
      `color-mix(in srgb, ${tokens.surface} 92%, ${tokens.contrast} 8%)`,
    )
    const expectedPressed = await resolveBackground(
      page,
      `color-mix(in srgb, ${tokens.surface} 88%, ${tokens.contrast} 12%)`,
    )
    await expect(menu).toHaveCSS('background-color', expectedSurface)
    expect((await computedValue(menu, '--interactive-surface-bg')).trim()).toBe(tokens.surface)
    await item.hover()
    await expect(item).toHaveCSS('background-color', expectedHover)
    await page.mouse.down()
    await expect(item).toHaveCSS('background-color', expectedPressed)
    await page.mouse.move(0, 0)
    await page.mouse.up()
    await page.keyboard.press('Home')
    await expect(item).toBeFocused()
    await expect(item).toHaveCSS('background-color', expectedHover)
    await expect(item).toHaveCSS('outline-style', 'solid')
    expect(await computedValue(item, 'outline-color')).not.toBe('rgba(0, 0, 0, 0)')
    await page.keyboard.press('Escape')
  }
})

let consumerHarnessBundle: Promise<string> | null = null

async function buildConsumerHarness() {
  if (consumerHarnessBundle) return consumerHarnessBundle
  consumerHarnessBundle = (async () => {
    const virtualId = 'virtual:workspace-ribbon-add-menu-consumer-harness'
    const resolvedId = `\0${virtualId}`
    const componentPath = path.resolve('src/components/WorkspaceRibbonAddMenu.tsx')
    const source = `
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { WorkspaceRibbonAddMenu } from ${JSON.stringify(componentPath)}
      let root = createRoot(document.querySelector('#consumer-root'))
      let key = 0
      let ribbonOpen = true
      const evidence = { closeRibbon: 0, addProject: 0, createNew: 0, addToRibbon: [] }
      const render = () => root.render(React.createElement(WorkspaceRibbonAddMenu, {
        key,
        hiddenWorkspaces: [{ id: 'hidden-workspace', label: 'Hidden workspace', icon: 'workspaces' }],
        ribbonOpen,
        closeRibbon: () => { evidence.closeRibbon += 1 },
        openAddModal: () => { evidence.addProject += 1 },
        openCreateModal: () => { evidence.createNew += 1 },
        requestAddToRibbon: (id) => { evidence.addToRibbon.push(id) },
      }))
      window.__workspaceRibbonAddHarness = {
        mount() { render() },
        setRibbonOpen(next) { ribbonOpen = next; render() },
        replace() { key += 1; ribbonOpen = true; render() },
        unmount() { root.unmount() },
        evidence() { return JSON.parse(JSON.stringify(evidence)) },
      }
    `
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'workspace-ribbon-add-menu-consumer-harness',
        resolveId(id) { return id === virtualId ? resolvedId : null },
        load(id) { return id === resolvedId ? source : null },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: virtualId, output: { format: 'iife', name: 'WorkspaceRibbonAddHarness' } },
      },
    }) as { output: Array<{ type: string; code?: string }> }
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code)
    if (!chunk?.code) throw new Error('Workspace Ribbon Add consumer harness did not build')
    return chunk.code
  })()
  return consumerHarnessBundle
}

test('one current handle closes on containing closure, replacement, and unmount with exactly-once actions', async ({ page }) => {
  await page.setContent('<div id="consumer-root"></div>')
  await page.addScriptTag({ content: await buildConsumerHarness() })
  await page.evaluate(() => window.__workspaceRibbonAddHarness.mount())
  let trigger = page.getByTitle('Add to ribbon', { exact: true })
  await trigger.click()
  let menu = page.getByRole('menu', { name: 'Add workspace to ribbon', exact: true })
  const hidden = menu.getByRole('menuitem', { name: 'Hidden workspace', exact: true })
  await hidden.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
  await expect(menu).toHaveCount(0)
  expect(await page.evaluate(() => window.__workspaceRibbonAddHarness.evidence())).toMatchObject({
    addToRibbon: ['hidden-workspace'],
  })

  await trigger.click()
  menu = page.getByRole('menu', { name: 'Add workspace to ribbon', exact: true })
  const addProject = menu.getByRole('menuitem', { name: 'Add Project', exact: true })
  await addProject.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
  await expect(menu).toHaveCount(0)
  expect(await page.evaluate(() => window.__workspaceRibbonAddHarness.evidence())).toMatchObject({
    closeRibbon: 1,
    addProject: 1,
  })

  await trigger.click()
  await page.evaluate(() => window.__workspaceRibbonAddHarness.setRibbonOpen(false))
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await page.evaluate(() => window.__workspaceRibbonAddHarness.setRibbonOpen(true))
  await trigger.click()
  await page.evaluate(() => window.__workspaceRibbonAddHarness.replace())
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  trigger = page.getByTitle('Add to ribbon', { exact: true })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()
  menu = page.getByRole('menu', { name: 'Add workspace to ribbon', exact: true })
  await menu.getByRole('menuitem', { name: 'Create New', exact: true }).press('Space')
  expect(await page.evaluate(() => window.__workspaceRibbonAddHarness.evidence())).toMatchObject({
    closeRibbon: 2,
    createNew: 1,
  })
  await trigger.click()
  await page.evaluate(() => window.__workspaceRibbonAddHarness.unmount())
  await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
})

test('source sweep proves only the old Add-menu path is retired', () => {
  const read = (relative: string) => fs.readFileSync(path.resolve(relative), 'utf8')
  const ribbon = read('src/components/WorkspaceRibbon.tsx')
  const addMenu = read('src/components/WorkspaceRibbonAddMenu.tsx')
  const ribbonCss = read('src/components/WorkspaceRibbon.css')
  const menuModules = [
    'src/components/menu/MenuSurface.ts',
    'src/components/menu/menuKeyboard.ts',
    'src/components/menu/menuSurfaceRecords.ts',
    'src/components/menu/menuTree.ts',
    'src/components/menu/menuTreeRecords.ts',
  ].map(read).join('\n')

  expect(ribbon).not.toContain('isAddDropdownOpen')
  expect(ribbon).not.toContain('addDropdownRef')
  expect(ribbon).not.toContain('rv-workspace-ribbon-add-menu')
  expect(ribbon).not.toContain("document.addEventListener('keydown'")
  expect(ribbon).not.toContain("document.addEventListener('pointerdown'")
  expect(ribbonCss).not.toContain('.rv-workspace-ribbon-add-menu')
  expect(addMenu).toContain('openMenuTree')
  expect(addMenu).not.toContain('document.addEventListener')
  expect(menuModules).not.toMatch(/kind\s*!==\s*['"]separator['"]|kind\s*===\s*['"]separator['"]\s*\|\|/)
  expect(ribbon).toContain('rv-workspace-ribbon-grid')
  expect(ribbon).toContain('onRibbonItemsDragOver')
  expect(ribbon).toContain('requestRemoveFromRibbon')
  expect(ribbon).toContain('rv-workspace-ribbon-scrim')
})
