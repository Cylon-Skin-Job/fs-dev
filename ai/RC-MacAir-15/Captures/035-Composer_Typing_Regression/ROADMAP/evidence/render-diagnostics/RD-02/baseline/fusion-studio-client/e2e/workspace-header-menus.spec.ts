import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
import { build } from 'vite'

async function openWorkspace(page: Page) {
  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toBeVisible()
}

async function expectInsideViewport(page: Page, menu: Locator) {
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(8)
  expect(box!.y).toBeGreaterThanOrEqual(8)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width - 8)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height - 8)
}

async function moveTriggerToCorner(
  page: Page,
  trigger: Locator,
  horizontal: 'left' | 'right',
  vertical: 'top' | 'bottom',
) {
  await trigger.evaluate((element, position) => {
    const target = element as HTMLElement
    target.style.position = 'fixed'
    target.style.zIndex = '2000'
    target.style.left = position.horizontal === 'left' ? '1px' : 'auto'
    target.style.right = position.horizontal === 'right' ? '1px' : 'auto'
    target.style.top = position.vertical === 'top' ? '1px' : 'auto'
    target.style.bottom = position.vertical === 'bottom' ? '1px' : 'auto'
  }, { horizontal, vertical })
  await trigger.click()
  const name = await trigger.getAttribute('aria-label') === 'AI source'
    ? 'AI source'
    : 'Workspace controls'
  await expectInsideViewport(page, page.getByRole('menu', { name, exact: true }))
  await page.keyboard.press('Escape')
}

async function computedColor(locator: Locator, property: string) {
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

test('AI source uses checked radio semantics and complete keyboard/dismissal behavior', async ({ page }) => {
  await openWorkspace(page)
  const trigger = page.getByRole('button', { name: 'AI source', exact: true })
  const menu = page.getByRole('menu', { name: 'AI source', exact: true })

  await expect(page.locator('.rv-ai-source-selector select')).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toHaveClass(/rv-interaction-context/)

  const local = menu.getByRole('menuitemradio', { name: /Local: Office-E2E/ })
  const remote = menu.getByRole('menuitemradio', { name: /Remote: Not configured/ })
  await expect(local).toHaveAttribute('aria-checked', 'true')
  await expect(local).toBeFocused()
  await expect(remote).toHaveAttribute('aria-checked', 'false')
  await expect(remote).toBeDisabled()
  await local.press('ArrowDown')
  await expect(local).toBeFocused()
  await local.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()

  await trigger.press('Space')
  await expect(local).toBeFocused()
  await local.press('Space')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.press('Space')
  await expect(local).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.press('Enter')
  await local.press('Tab')
  await expect(menu).toHaveCount(0)
  await expect(page.getByTitle('Previous workspace')).toBeFocused()

  await trigger.click()
  await page.locator('.rv-connection-status').click({ position: { x: 2, y: 2 } })
  await expect(menu).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()
  await trigger.click()
  await expect(menu).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('Workspace Controls preserves order, roving focus, dismissal, and destination focus', async ({ page }) => {
  await openWorkspace(page)
  const trigger = page.getByRole('button', { name: 'Open workspace controls' })
  const menu = page.getByRole('menu', { name: 'Workspace controls', exact: true })

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const connectors = menu.getByRole('menuitem', { name: 'macOS Connectors', exact: true })
  const fusion = menu.getByRole('menuitem', { name: 'Fusion', exact: true })
  const theme = menu.getByRole('menuitem', { name: 'Workspace theme', exact: true })
  await expect(connectors).toBeFocused()
  await connectors.press('ArrowDown')
  await expect(fusion).toBeFocused()
  await fusion.press('End')
  await expect(theme).toBeFocused()
  await theme.press('ArrowDown')
  await expect(connectors).toBeFocused()
  await connectors.press('Home')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.press('Space')
  await connectors.press('Enter')
  const connectorsSurface = page.getByRole('menu', { name: 'macOS Connectors', exact: true })
  await expect(menu).toHaveCount(0)
  await expect(connectorsSurface).toHaveAttribute('data-open', 'true')
  await expect(connectorsSurface.locator('.rv-connectors-toggle').first()).toBeFocused()
  await expect(connectorsSurface).toHaveCount(1)
  await connectorsSurface.getByRole('button', { name: 'Close' }).click()
  await expect(connectorsSurface).toHaveAttribute('data-open', 'false')

  await trigger.click()
  await fusion.press('Space')
  await expect(page.locator('.rv-fusion-overlay')).toHaveCount(1)
  await expect(page.locator('.rv-fusion-exit-btn')).toBeFocused()
  await page.locator('.rv-fusion-exit-btn').click()

  await trigger.click()
  await theme.press('Enter')
  await expect(page.locator('.rv-theme-picker-modal')).toHaveCount(1)
  await expect(page.locator('.rv-theme-picker-modal .rv-tp-mode-btn').first()).toBeFocused()
  await page.locator('.rv-theme-picker-scrim').click({ position: { x: 2, y: 2 } })

  await trigger.click()
  await menu.getByRole('menuitem', { name: 'macOS Connectors', exact: true }).click()
  await expect(connectorsSurface).toHaveAttribute('data-open', 'true')
  await page.locator('.rv-connection-status').click({ position: { x: 2, y: 2 } })
  await expect(connectorsSurface).toHaveAttribute('data-open', 'false')

  await trigger.click()
  await menu.getByRole('menuitem', { name: 'macOS Connectors', exact: true }).press('Tab')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await page.locator('.rv-connection-status').click({ position: { x: 2, y: 2 } })
  await expect(menu).toHaveCount(0)
})

test('closing Connectors before delayed frames flush cannot focus its hidden controls', async ({ page }) => {
  await openWorkspace(page)
  const trigger = page.getByRole('button', { name: 'Open workspace controls' })
  const connectorsSurface = page.getByRole('menu', { name: 'macOS Connectors', exact: true })
  const firstToggle = connectorsSurface.locator('.rv-connectors-toggle').first()

  await trigger.click()
  const connectorsAction = page
    .getByRole('menu', { name: 'Workspace controls', exact: true })
    .getByRole('menuitem', { name: 'macOS Connectors', exact: true })
  await page.evaluate(() => {
    const originalRequest = window.requestAnimationFrame.bind(window)
    const originalCancel = window.cancelAnimationFrame.bind(window)
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextId = 1
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }
    window.cancelAnimationFrame = (id: number) => callbacks.delete(id)
    ;(window as any).__flushHeldAnimationFrames = () => {
      window.requestAnimationFrame = originalRequest
      window.cancelAnimationFrame = originalCancel
      const held = [...callbacks.values()]
      callbacks.clear()
      held.forEach((callback) => callback(performance.now()))
    }
  })

  await connectorsAction.press('Enter')
  await expect(connectorsSurface).toHaveAttribute('data-open', 'true')
  await expect(firstToggle).toBeFocused()
  await page.locator('.rv-connection-status').dispatchEvent('pointerdown')
  await expect(connectorsSurface).toHaveAttribute('data-open', 'false')
  await page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })
  await expect(firstToggle).not.toBeFocused()

  await page.evaluate(() => (window as any).__flushHeldAnimationFrames())
  await expect(firstToggle).not.toBeFocused()
})

test('both visible header triggers keep their menus inside every viewport corner', async ({ page }) => {
  await openWorkspace(page)
  for (const trigger of [
    page.getByRole('button', { name: 'AI source', exact: true }),
    page.getByRole('button', { name: 'Open workspace controls' }),
  ]) {
    const originalStyle = await trigger.getAttribute('style')
    for (const horizontal of ['left', 'right'] as const) {
      for (const vertical of ['top', 'bottom'] as const) {
        await moveTriggerToCorner(page, trigger, horizontal, vertical)
      }
    }
    await trigger.evaluate((element, style) => {
      if (style === null) element.removeAttribute('style')
      else element.setAttribute('style', style)
    }, originalStyle)
  }
})

test('header menus derive hover, pressed, and focus from their effective dark/light surfaces', async ({ page }) => {
  await openWorkspace(page)
  const cases = [
    { surface: '#20242a', contrast: '#ffffff' },
    { surface: '#e4e7eb', contrast: '#000000' },
  ]
  for (const tokens of cases) {
    await page.evaluate(({ surface, contrast }) => {
      document.documentElement.style.setProperty('--rv-menu-surface-bg', surface)
      document.documentElement.style.setProperty('--interactive-contrast-foreground', contrast)
      document.documentElement.style.setProperty(
        '--interactive-focus-ring',
        'color-mix(in srgb, var(--interactive-contrast-foreground) 75%, transparent)',
      )
    }, tokens)
    const expectedSurface = await resolveBackground(page, tokens.surface)
    const expectedHover = await resolveBackground(
      page,
      `color-mix(in srgb, ${tokens.surface} 92%, ${tokens.contrast} 8%)`,
    )
    const expectedPressed = await resolveBackground(
      page,
      `color-mix(in srgb, ${tokens.surface} 88%, ${tokens.contrast} 12%)`,
    )

    for (const entry of [
      { trigger: page.getByRole('button', { name: 'AI source', exact: true }), menu: 'AI source' },
      { trigger: page.getByRole('button', { name: 'Open workspace controls' }), menu: 'Workspace controls' },
    ]) {
      await entry.trigger.click()
      const menu = page.getByRole('menu', { name: entry.menu, exact: true })
      const item = menu.locator('.rv-menu-item:not(:disabled)').first()
      await expect(menu).toHaveCSS('background-color', expectedSurface)
      expect((await computedColor(menu, '--interactive-surface-bg')).trim()).toBe(tokens.surface)
      await item.hover()
      await expect(item).toHaveCSS('background-color', expectedHover)
      await page.mouse.down()
      await expect(item).toHaveCSS('background-color', expectedPressed)
      await page.mouse.move(0, 0)
      await page.mouse.up()
      await page.keyboard.press('Home')
      await expect(item).toBeFocused()
      await expect(item).toHaveCSS('outline-style', 'solid')
      expect(await computedColor(item, 'outline-color')).not.toBe('rgba(0, 0, 0, 0)')
      await page.keyboard.press('Escape')
    }
  }
})

let componentHarnessBundle: Promise<string> | null = null

async function buildComponentHarness() {
  if (componentHarnessBundle) return componentHarnessBundle
  componentHarnessBundle = (async () => {
    const virtualId = 'virtual:workspace-header-menu-consumer-harness'
    const resolvedId = `\0${virtualId}`
    const aiPath = path.resolve('src/components/AiSourceSelector.tsx')
    const actionsPath = path.resolve('src/components/HeaderActionsMenu.tsx')
    const source = `
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { AiSourceSelector } from ${JSON.stringify(aiPath)}
      import { HeaderActionsMenu } from ${JSON.stringify(actionsPath)}
      let root = null
      let key = 0
      const host = document.querySelector('#consumer-root')
      const render = (kind) => {
        if (!root) root = createRoot(host)
        const Component = kind === 'source' ? AiSourceSelector : HeaderActionsMenu
        const props = kind === 'source' ? { key } : { key, onOpenFusion: () => {} }
        root.render(React.createElement(Component, props))
      }
      window.__workspaceHeaderHarness = {
        mount(kind) { render(kind) },
        replace(kind) { key += 1; render(kind) },
        unmount() { root?.unmount(); root = null },
      }
    `
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'workspace-header-menu-consumer-harness',
        resolveId(id) { return id === virtualId ? resolvedId : null },
        load(id) { return id === resolvedId ? source : null },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: virtualId, output: { format: 'iife', name: 'WorkspaceHeaderHarness' } },
      },
    }) as { output: Array<{ type: string; code?: string }> }
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code)
    if (!chunk?.code) throw new Error('Workspace header consumer harness did not build')
    return chunk.code
  })()
  return componentHarnessBundle
}

test('consumer unmount and trigger replacement close their one current menu handle', async ({ page }) => {
  await page.setContent('<div id="consumer-root"></div>')
  await page.addScriptTag({ content: await buildComponentHarness() })
  for (const kind of ['source', 'actions'] as const) {
    await page.evaluate((value) => (window as any).__workspaceHeaderHarness.mount(value), kind)
    const trigger = kind === 'source'
      ? page.getByRole('button', { name: 'AI source', exact: true })
      : page.getByRole('button', { name: 'Open workspace controls' })
    await trigger.click()
    await expect(page.locator('.rv-menu-surface')).toHaveCount(1)
    await page.evaluate((value) => (window as any).__workspaceHeaderHarness.replace(value), kind)
    await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.click()
    await expect(page.locator('.rv-menu-surface')).toHaveCount(1)
    await page.evaluate(() => (window as any).__workspaceHeaderHarness.unmount())
    await expect(page.locator('.rv-menu-surface')).toHaveCount(0)
  }
})

test('source sweep proves retired header menu paths are gone and specialized dropdown CSS remains', () => {
  const read = (relative: string) => fs.readFileSync(path.resolve(relative), 'utf8')
  const source = read('src/components/AiSourceSelector.tsx')
  const sourceCss = read('src/components/AiSourceSelector.css')
  const actions = read('src/components/HeaderActionsMenu.tsx')
  const actionCss = read('src/components/HeaderActionsMenu.css')
  const connectors = read('src/components/ConnectorsDropdown.tsx')
  const menuSurface = read('src/components/menu/MenuSurface.ts')
  const menuCss = read('src/components/menu/MenuSurface.css')

  expect(source).not.toContain('<select')
  expect(sourceCss).not.toContain('__select')
  expect(actions).not.toContain('rv-dropdown')
  expect(actions).not.toContain('handleClickOutside')
  expect(actionCss).not.toMatch(/\.rv-header-actions-menu\s*\{/)
  expect(connectors).toContain("document.addEventListener('pointerdown', handleOutsidePointer, true)")
  expect(menuSurface).toContain("'rv-menu-surface rv-interaction-context'")
  expect(menuCss).toContain('--interactive-surface-bg: var(--rv-menu-surface-bg')
  expect(menuCss).not.toContain('--interactive-surface-hover')
  expect(fs.existsSync(path.resolve('src/styles/dropdown.css'))).toBe(true)
})
