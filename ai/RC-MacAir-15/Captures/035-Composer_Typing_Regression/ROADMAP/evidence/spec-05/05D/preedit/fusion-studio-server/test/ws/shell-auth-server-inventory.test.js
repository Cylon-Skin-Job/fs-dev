'use strict';

const fs = require('node:fs');
const path = require('node:path');

describe('production shell authentication wiring', () => {
  test('places thread manager initialization only inside the authenticated initialization callback', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    const connectionStart = source.indexOf("wss.on('connection'");
    const transportTrackStart = source.indexOf('transportConnectionRegistry.track(ws, productConnection.waitForCleanup)', connectionStart);
    const deferredStart = source.indexOf('const productConnection = createDeferredProductConnection', connectionStart);
    const productBuildStart = source.indexOf('build: async ({ ownCleanup }) => {', deferredStart);
    const workspaceLookupStart = source.indexOf('workspaceController.getActiveWorkspaceSync()', productBuildStart);
    const wireRouterStart = source.indexOf('createWireMessageRouter({', productBuildStart);
    const wireLifecycleStart = source.indexOf('createWireLifecycle({', productBuildStart);
    const clientRouterStart = source.indexOf('createClientMessageRouter({', productBuildStart);
    const cleanupOwnershipStart = source.indexOf('ownCleanup(handleClientClose)', productBuildStart);
    const officeRouterStart = source.indexOf('createOfficePaletteDispatch({', productBuildStart);
    const initializeStart = source.indexOf('const initializeConnection = async () =>', connectionStart);
    const runtimeWaitStart = source.indexOf('await serverRuntimeActivation.wait()', initializeStart);
    const workspaceLaneStart = source.indexOf('await workspaceController.runInWorkspaceLifecycle', initializeStart);
    const productInitializeStart = source.indexOf('await productConnection.initialize()', initializeStart);
    const managerStart = source.indexOf('ThreadWebSocketHandler.setPanel', connectionStart);
    const activateStart = source.indexOf('productSessionRegistry.activate({', initializeStart);
    const authDispatchStart = source.indexOf('const authenticatedDispatch = createShellAuthDispatch', connectionStart);

    expect(connectionStart).toBeGreaterThan(-1);
    expect(transportTrackStart).toBeGreaterThan(connectionStart);
    expect(deferredStart).toBeGreaterThan(connectionStart);
    expect(transportTrackStart).toBeGreaterThan(deferredStart);
    expect(productBuildStart).toBeGreaterThan(deferredStart);
    expect(workspaceLookupStart).toBeGreaterThan(productBuildStart);
    expect(wireRouterStart).toBeGreaterThan(productBuildStart);
    expect(wireLifecycleStart).toBeGreaterThan(wireRouterStart);
    expect(clientRouterStart).toBeGreaterThan(wireLifecycleStart);
    expect(cleanupOwnershipStart).toBeGreaterThan(clientRouterStart);
    expect(cleanupOwnershipStart).toBeLessThan(officeRouterStart);
    expect(officeRouterStart).toBeGreaterThan(clientRouterStart);
    expect(officeRouterStart).toBeLessThan(initializeStart);
    expect(transportTrackStart).toBeLessThan(initializeStart);
    expect(initializeStart).toBeGreaterThan(connectionStart);
    expect(runtimeWaitStart).toBeGreaterThan(initializeStart);
    expect(workspaceLaneStart).toBeGreaterThan(runtimeWaitStart);
    expect(productInitializeStart).toBeGreaterThan(runtimeWaitStart);
    expect(managerStart).toBeGreaterThan(initializeStart);
    expect(managerStart).toBeLessThan(authDispatchStart);
    expect(activateStart).toBeGreaterThan(productInitializeStart);
    expect(activateStart).toBeLessThan(authDispatchStart);
    expect(source.slice(connectionStart, initializeStart)).not.toContain('ThreadWebSocketHandler.setPanel');
    expect(source.slice(connectionStart, initializeStart)).not.toContain('sessions.set(');
    expect(source.slice(connectionStart, initializeStart)).not.toContain('beginWorkspaceBind(');
    const pendingSetup = source.slice(connectionStart, productBuildStart);
    expect(pendingSetup).not.toContain('workspaceController.getActiveWorkspaceSync');
    expect(pendingSetup).not.toContain('createWireMessageRouter');
    expect(pendingSetup).not.toContain('createWireLifecycle');
    expect(pendingSetup).not.toContain('createClientMessageRouter');
    expect(pendingSetup).not.toContain('createOfficePaletteDispatch');
    expect(source.slice(initializeStart, authDispatchStart)).toContain('await productConnection.initialize()');
    expect(source.slice(authDispatchStart, source.indexOf('// Server Startup', authDispatchStart)))
      .toContain('initialize: initializeConnection');
    expect(source.match(/ThreadWebSocketHandler\.setPanel/g)).toHaveLength(1);
    expect(source.match(/sessions\.set\(/g)).toBeNull();
    expect(source).toContain('transportConnectionRegistry,');
    expect(source).toContain('maxPayload: MAX_SHELL_AUTH_FRAME_BYTES');
    expect(source).toContain('activateTransport: () => activateApplicationPayloadLimit(ws)');
    expect(source).toContain('transportConnectionRegistry.track(ws, productConnection.waitForCleanup)');
    expect(source).toContain("ws.on('error', () => console.warn('[WS] transport_error'))");
  });

  test('publishes the runtime endpoint and releases product initialization only after startup handlers exist', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    const startupSource = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'startup.js'), 'utf8');
    const resolution = serverSource.indexOf('.then(result => {');
    const handlerPublication = serverSource.indexOf('screenshotHandlers = result.screenshotHandlers || {};', resolution);
    const readiness = serverSource.indexOf('process.stdout.write(`SERVER_READY:${boundPort}\\n`)', resolution);
    const activation = serverSource.indexOf('serverRuntimeActivation.activate()', resolution);
    const failure = serverSource.indexOf('serverRuntimeActivation.fail()', activation);

    expect(resolution).toBeGreaterThan(-1);
    expect(handlerPublication).toBeGreaterThan(resolution);
    expect(readiness).toBeGreaterThan(handlerPublication);
    expect(activation).toBeGreaterThan(readiness);
    expect(failure).toBeGreaterThan(activation);
    expect(startupSource).not.toContain('SERVER_READY:');
  });
});
