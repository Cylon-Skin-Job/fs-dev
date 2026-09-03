import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

import {
  createOfficeProcessLifecycle,
  createOfficeRuntimeLayout,
  finalizeOfficeProcessLifecycle,
  installOfficeSignalCleanup,
  officeRuntimeEnvironment,
  startOfficeOwnedProcess,
  validateOfficeFixtureOptions,
} from './fixture-lifecycle.mjs'

const lifecycleStateKey = Symbol.for('fusion-studio.office-e2e.playwright-lifecycle')

function parseEnvironmentCount(name, fallback, minimum, maximum) {
  const raw = process.env[name] ?? String(fallback)
  if (!/^(0|[1-9]\d*)$/.test(raw)) throw new Error(`${name} must be an integer`)
  const value = Number(raw)
  if (value < minimum || value > maximum) {
    throw new Error(`${name} must be from ${minimum} through ${maximum}`)
  }
  return value
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}

export function officePlaywrightPort() {
  const port = parseEnvironmentCount('FUSION_OFFICE_E2E_PORT', 3311, 1024, 65535)
  if (port === 3001) throw new Error('FUSION_OFFICE_E2E_PORT must not use production port 3001')
  return port
}

function fixtureOptionsFromEnvironment() {
  const options = {
    workspaces: parseEnvironmentCount('FUSION_OFFICE_E2E_WORKSPACES', 3, 1, 3),
    copies: parseEnvironmentCount('FUSION_OFFICE_E2E_COPIES', 1, 1, 32),
    scenario: process.env.FUSION_OFFICE_E2E_SCENARIO ?? 'basic',
  }
  if (process.env.FUSION_OFFICE_E2E_RUN_ROOT !== undefined) {
    options.root = process.env.FUSION_OFFICE_E2E_RUN_ROOT
  }
  if (process.env.FUSION_OFFICE_E2E_VARIANT !== undefined) {
    options.variant = process.env.FUSION_OFFICE_E2E_VARIANT
  }
  return validateOfficeFixtureOptions(options)
}

function seedCaptureRehydrationFixtures(fixture) {
  for (const [suffix, workspaceRoot] of Object.entries(fixture.workspaceRoots)) {
    const machineRoot = path.join(workspaceRoot, 'ai', fixture.machineName)
    const viewRoot = path.join(machineRoot, 'Views', '002-capture-viewer')
    const capturesRoot = path.join(machineRoot, 'Captures', '001-Fixtures')
    const emailViewRoot = path.join(machineRoot, 'Views', '003-email-viewer')
    const emailRoot = path.join(machineRoot, 'Email', '009-Email-Fixture')
    fs.mkdirSync(path.join(viewRoot, 'styles'), { recursive: true })
    fs.mkdirSync(path.join(viewRoot, 'state'), { recursive: true })
    fs.mkdirSync(capturesRoot, { recursive: true })
    fs.writeFileSync(path.join(viewRoot, 'manifest.md'), [
      '---',
      'name: Captures',
      'metadata:',
      '  view-id: capture-viewer',
      '  view-type: captures',
      '  data-source: Captures',
      '  enabled: true',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(viewRoot, 'content.json'), `${JSON.stringify({
      version: 1,
      dataSource: 'Captures',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Captures' },
    }, null, 2)}\n`)
    fs.writeFileSync(path.join(viewRoot, 'styles', 'icon.md'), [
      '---',
      'metadata:',
      '  icon-name: open_run',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(viewRoot, 'styles', 'layout.json'), '{}\n')
    fs.writeFileSync(path.join(viewRoot, 'styles', 'layout.css'), '\n')
    fs.writeFileSync(path.join(viewRoot, 'state', 'state.json'), '{}\n')
    fs.writeFileSync(
      path.join(capturesRoot, `Capture-${suffix.toUpperCase()}.md`),
      `# Capture ${suffix.toUpperCase()}\n`,
    )
    fs.writeFileSync(
      path.join(capturesRoot, `Capture-${suffix.toUpperCase()}-Second.md`),
      `# Capture ${suffix.toUpperCase()} Second\n`,
    )

    const fileViewRoot = path.join(machineRoot, 'Views', '005-file-viewer')
    fs.mkdirSync(path.join(fileViewRoot, 'styles'), { recursive: true })
    fs.mkdirSync(path.join(fileViewRoot, 'state'), { recursive: true })
    fs.writeFileSync(path.join(fileViewRoot, 'manifest.md'), [
      '---',
      'name: Files',
      'metadata:',
      '  view-id: file-viewer',
      '  view-type: files',
      '  data-source: project-root',
      '  enabled: true',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(fileViewRoot, 'content.json'), `${JSON.stringify({
      version: 1,
      dataSource: 'project-root',
      root: { type: 'project-root' },
    }, null, 2)}\n`)
    fs.writeFileSync(path.join(fileViewRoot, 'styles', 'icon.md'), [
      '---',
      'metadata:',
      '  icon-name: folder_code',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(fileViewRoot, 'styles', 'layout.json'), '{}\n')
    fs.writeFileSync(path.join(fileViewRoot, 'styles', 'layout.css'), '\n')
    fs.writeFileSync(path.join(fileViewRoot, 'state', 'state.json'), '{}\n')
    fs.writeFileSync(path.join(workspaceRoot, `Tab-${suffix.toUpperCase()}-One.md`), '# File one\n')
    fs.writeFileSync(path.join(workspaceRoot, `Tab-${suffix.toUpperCase()}-Two.md`), '# File two\n')

    fs.mkdirSync(path.join(emailViewRoot, 'styles'), { recursive: true })
    fs.mkdirSync(path.join(emailViewRoot, 'state'), { recursive: true })
    fs.mkdirSync(emailRoot, { recursive: true })
    fs.writeFileSync(path.join(emailViewRoot, 'manifest.md'), [
      '---',
      'name: Email',
      'metadata:',
      '  view-id: email-viewer',
      '  view-type: email',
      '  data-source: Email',
      '  enabled: true',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(emailViewRoot, 'content.json'), `${JSON.stringify({
      version: 1,
      dataSource: 'Email',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Email' },
    }, null, 2)}\n`)
    fs.writeFileSync(path.join(emailViewRoot, 'styles', 'icon.md'), [
      '---',
      'metadata:',
      '  icon-name: mail',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(emailViewRoot, 'styles', 'layout.json'), '{}\n')
    fs.writeFileSync(path.join(emailViewRoot, 'styles', 'layout.css'), '\n')
    fs.writeFileSync(path.join(emailViewRoot, 'state', 'state.json'), `${JSON.stringify({
      emailViewerMode: 'home',
      emailViewerCurrentFolder: null,
      emailViewerSelectedPath: null,
    }, null, 2)}\n`)
    fs.writeFileSync(
      path.join(emailRoot, `Email-${suffix.toUpperCase()}.md`),
      `# Email ${suffix.toUpperCase()}\n`,
    )

    const issuesViewRoot = path.join(machineRoot, 'Views', '004-issues-viewer')
    const issuesRoot = path.join(machineRoot, 'Issues')
    fs.mkdirSync(path.join(issuesViewRoot, 'styles'), { recursive: true })
    fs.mkdirSync(path.join(issuesViewRoot, 'state'), { recursive: true })
    fs.mkdirSync(path.join(issuesRoot, 'content'), { recursive: true })
    fs.mkdirSync(path.join(issuesRoot, 'inbox'), { recursive: true })
    fs.writeFileSync(path.join(issuesViewRoot, 'manifest.md'), [
      '---',
      'name: Issues',
      'metadata:',
      '  view-id: issues-viewer',
      '  view-type: ticket-board',
      '  data-source: Issues',
      '  enabled: true',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(issuesViewRoot, 'content.json'), `${JSON.stringify({
      version: 1,
      dataSource: 'Issues',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Issues' },
    }, null, 2)}\n`)
    fs.writeFileSync(path.join(issuesViewRoot, 'styles', 'icon.md'), [
      '---',
      'metadata:',
      '  icon-name: business_messages',
      '---',
      '',
    ].join('\n'))
    fs.writeFileSync(path.join(issuesViewRoot, 'styles', 'layout.json'), '{}\n')
    fs.writeFileSync(path.join(issuesViewRoot, 'styles', 'layout.css'), '\n')
    fs.writeFileSync(path.join(issuesViewRoot, 'state', 'state.json'), '{}\n')
    const ticketId = `E2E-${suffix.toUpperCase()}`
    const ticket = {
      title: `Menu fixture ${suffix.toUpperCase()}`,
      assignee: 'fixture-owner',
      created: '2026-09-02T12:00:00.000Z',
      author: 'fixture',
      state: 'open',
      priority: 'medium',
      body: 'Mounted ticket menu fixture.',
    }
    fs.writeFileSync(path.join(issuesRoot, 'content', 'tickets.json'), `${JSON.stringify({
      version: '2.0',
      tickets: { [ticketId]: ticket },
    }, null, 2)}\n`)
    fs.writeFileSync(path.join(issuesRoot, 'inbox', `${ticketId}.md`), [
      '---',
      `id: ${ticketId}`,
      `title: '${ticket.title}'`,
      `assignee: ${ticket.assignee}`,
      `created: ${ticket.created}`,
      `author: ${ticket.author}`,
      `state: ${ticket.state}`,
      `priority: ${ticket.priority}`,
      '---',
      '',
      ticket.body,
      '',
    ].join('\n'))

    const systemStatePath = path.join(machineRoot, 'System', 'state', 'state.json')
    let systemState = {}
    try {
      systemState = JSON.parse(fs.readFileSync(systemStatePath, 'utf8'))
    } catch {
      // The isolated fixture owns this state file; a missing file starts empty.
    }
    const workspaceState = systemState.workspace && typeof systemState.workspace === 'object'
      ? systemState.workspace
      : {}
    fs.mkdirSync(path.dirname(systemStatePath), { recursive: true })
    fs.writeFileSync(systemStatePath, `${JSON.stringify({
      ...systemState,
      workspace: {
        ...workspaceState,
        currentPanel: 'office-viewer',
      },
    }, null, 2)}\n`)
  }
}

export default async function globalSetup() {
  if (globalThis[lifecycleStateKey]) throw new Error('Office Playwright lifecycle is already active')
  const port = officePlaywrightPort()
  const fixtureOptions = fixtureOptionsFromEnvironment()
  await assertPortAvailable(port)

  let lifecycle
  const removeSignalHandlers = installOfficeSignalCleanup()
  try {
    lifecycle = await createOfficeProcessLifecycle(fixtureOptions)
    removeSignalHandlers.attach(lifecycle)
    globalThis[lifecycleStateKey] = { lifecycle, removeSignalHandlers }
    seedCaptureRehydrationFixtures(lifecycle.fixture)

    const runtime = createOfficeRuntimeLayout(lifecycle.fixture)
    const runtimeEnvironment = officeRuntimeEnvironment(runtime)
    const build = startOfficeOwnedProcess(lifecycle, 'npm', ['run', 'build'], {
      cwd: runtime.runtimeClientRoot,
      env: runtimeEnvironment,
    })
    const buildResult = await build.completion
    if (buildResult.code !== 0) throw new Error(`Office client build failed: ${JSON.stringify(buildResult)}`)

    const readinessUrl = `http://127.0.0.1:${port}/`
    const isolatedTemporaryDirectory = path.join(lifecycle.fixture.root, 'tmp')
    fs.mkdirSync(isolatedTemporaryDirectory, { recursive: true })
    const server = startOfficeOwnedProcess(
      lifecycle,
      process.execPath,
      [runtime.serverEntry],
      {
        cwd: runtime.runtimeClientRoot,
        env: {
          ...runtimeEnvironment,
          FUSION_CALENDAR_APPLE_ENABLED: '0',
          FUSION_CALENDAR_GOOGLE_ENABLED: '0',
          FUSION_APP_PACKAGED: '1',
          FUSION_APP_USER_DATA: lifecycle.fixture.appUserData,
          FUSION_LOCAL_MACHINE: lifecycle.fixture.machineName,
          PORT: String(port),
          TMPDIR: isolatedTemporaryDirectory,
        },
        readyPattern: new RegExp(`SERVER_READY:${port}(?:\\D|$)`),
        readyUrl: readinessUrl,
      },
    )
    await server.ready
    process.env.FUSION_OFFICE_E2E_BASE_URL = readinessUrl
    process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT = lifecycle.fixture.root
  } catch (error) {
    let cleanupError = null
    try {
      if (lifecycle) await finalizeOfficeProcessLifecycle(lifecycle, { reason: 'setup' })
    } catch (candidate) {
      cleanupError = candidate
    } finally {
      removeSignalHandlers()
      delete globalThis[lifecycleStateKey]
      delete process.env.FUSION_OFFICE_E2E_BASE_URL
      delete process.env.FUSION_OFFICE_E2E_FIXTURE_ROOT
      delete process.env.FUSION_OFFICE_E2E_RUN_ROOT
    }
    if (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Office Playwright setup and cleanup both failed', {
        cause: error,
      })
    }
    throw error
  }
}

export function takeOfficePlaywrightLifecycleState() {
  const state = globalThis[lifecycleStateKey] ?? null
  delete globalThis[lifecycleStateKey]
  return state
}
