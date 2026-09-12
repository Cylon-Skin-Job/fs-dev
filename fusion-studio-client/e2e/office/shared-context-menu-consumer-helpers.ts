import fs from 'node:fs'
import path from 'node:path'

import { expect, type Locator, type Page } from '@playwright/test'

export const BASIC_DOCUMENT = 'Basic Tables.md'
export const OFFICE_FOLDER = '001-Fixtures'

export function fixtureWorkspaceRoot() {
  const fixtureRoot = process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
  if (!fixtureRoot) throw new Error('FUSION_OFFICE_E2E_FIXTURE_ROOT is not set')
  return path.join(fixtureRoot, 'workspace-a', 'ai', 'Office-E2E')
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function resetSupportingFixtures() {
  const machineRoot = fixtureWorkspaceRoot()
  const captureRoot = path.join(machineRoot, 'Captures')
  const emailRoot = path.join(machineRoot, 'Email')
  fs.rmSync(captureRoot, { recursive: true, force: true })
  fs.rmSync(emailRoot, { recursive: true, force: true })
  fs.mkdirSync(path.join(captureRoot, '001-Fixtures'), { recursive: true })
  fs.mkdirSync(path.join(captureRoot, '999-Archive'), { recursive: true })
  fs.mkdirSync(path.join(emailRoot, '009-Email-Fixture'), { recursive: true })
  fs.mkdirSync(path.join(emailRoot, '999-Archive'), { recursive: true })
  fs.writeFileSync(path.join(captureRoot, '001-Fixtures', 'Capture-A.md'), '# Capture A\n')
  fs.writeFileSync(path.join(emailRoot, '009-Email-Fixture', 'Email-A.md'), '# Email A\n')
  writeJson(path.join(machineRoot, 'System', 'Views', '002-capture-viewer', 'state', 'state.json'), {
    docViewerMode: 'active',
    docViewerActiveSelectedPath: null,
    docViewerArchiveSelectedPath: null,
    docViewerFullPage: false,
    collections: { starred: [], pinnedFolders: [] },
  })
  writeJson(path.join(machineRoot, 'System', 'Views', '003-email-viewer', 'state', 'state.json'), {
    emailViewerMode: 'home',
    emailViewerCurrentFolder: null,
    emailViewerSelectedPath: null,
    collections: { starred: [], pinnedFolders: [] },
  })
  const officeStatePath = path.join(machineRoot, 'System', 'Views', '001-office-viewer', 'state', 'state.json')
  const officeState = JSON.parse(fs.readFileSync(officeStatePath, 'utf8'))
  writeJson(officeStatePath, {
    ...officeState,
    collections: { starred: [], pinnedFolders: [] },
  })

  const officeRoot = path.join(machineRoot, 'Office')
  fs.mkdirSync(path.join(officeRoot, 'Rename Folder'), { recursive: true })
  fs.mkdirSync(path.join(officeRoot, 'Archive Folder'), { recursive: true })
  fs.mkdirSync(path.join(officeRoot, 'Delete Folder'), { recursive: true })
  fs.mkdirSync(path.join(officeRoot, '999-Archive'), { recursive: true })
  fs.writeFileSync(path.join(officeRoot, OFFICE_FOLDER, 'Archive Target.md'), '# Archive target\n')
  fs.writeFileSync(path.join(officeRoot, OFFICE_FOLDER, 'Delete Target.md'), '# Delete target\n')
  fs.writeFileSync(path.join(officeRoot, '999-Archive', 'Already Archived.md'), '# Archived\n')
}

export async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('.rv-workspace-name')).toBeVisible()
  await expect(page.locator('.rv-panel.active')).toBeVisible()
}

export async function openPanel(page: Page, title: 'Office' | 'Captures' | 'Email' | 'Issues') {
  await page.locator(`.rv-tool-btn[title="${title}"]`).click()
  const active = page.locator('.rv-panel.active')
  await expect(active).toBeVisible()
  return active
}

export async function openOfficeHome(page: Page) {
  await openApp(page)
  const panel = await openPanel(page, 'Office')
  await expect(panel.locator('.rv-office-shell')).toBeVisible()
  await expect(panel.getByTitle(OFFICE_FOLDER, { exact: true })).toBeVisible()
  return panel
}

export function observeSentMessages(page: Page) {
  const sent: Array<Record<string, unknown>> = []
  page.on('websocket', (socket) => socket.on('framesent', ({ payload }) => {
    if (typeof payload !== 'string') return
    try {
      sent.push(JSON.parse(payload) as Record<string, unknown>)
    } catch {
      // Non-JSON frames are outside these action routes.
    }
  }))
  return sent
}

export async function menuLabels(menu: Locator) {
  return menu.locator(':scope > [role="menuitem"]').evaluateAll((items) => (
    items.map((item) => item.querySelector('.rv-menu-item-label')?.textContent)
  ))
}

export async function assertWithinViewport(menu: Locator) {
  const bounds = await menu.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
  expect(bounds.left).toBeGreaterThanOrEqual(7.5)
  expect(bounds.top).toBeGreaterThanOrEqual(7.5)
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth - 7.5)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight - 7.5)
}

export async function startFocusTrace(page: Page) {
  await page.evaluate(() => {
    const observed = window as typeof window & {
      __adopt3FocusTrace?: string[]
      __adopt3FocusHandler?: (event: FocusEvent) => void
    }
    if (observed.__adopt3FocusHandler) {
      document.removeEventListener('focusin', observed.__adopt3FocusHandler)
    }
    observed.__adopt3FocusTrace = []
    observed.__adopt3FocusHandler = (event) => {
      const target = event.target as HTMLElement | null
      observed.__adopt3FocusTrace?.push(
        target?.getAttribute('aria-label')
          ?? target?.getAttribute('title')
          ?? target?.dataset.menuItemId
          ?? target?.tagName
          ?? 'unknown',
      )
    }
    document.addEventListener('focusin', observed.__adopt3FocusHandler)
  })
}

export async function focusTrace(page: Page) {
  return page.evaluate(() => (
    (window as typeof window & { __adopt3FocusTrace?: string[] }).__adopt3FocusTrace ?? []
  ))
}
