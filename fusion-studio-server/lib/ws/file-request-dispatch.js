/** Select existing file and provenance owners without changing their policies. */
const { panelPathRequiresViewReadiness } = require('../views/panel-paths');

function createFileRequestDispatch({
  ws, session, fileExplorer, runViewDiscoveryRequest,
  getFileViewerReadRoute, getFileSaveRoute, getResourceProvenanceRoute,
  getAgentActivityRoute, getAgentToolFixtureRoute, handleCanonicalHarnessEvent,
}) {
  async function handleRead(clientMsg) {
      if (clientMsg.type === 'file_tree_request') {
        if (
          clientMsg.panel == null
          || clientMsg.panel === 'file-viewer'
          || Object.prototype.hasOwnProperty.call(clientMsg, 'version')
        ) {
          const fileViewerReadRoute = getFileViewerReadRoute();
          if (fileViewerReadRoute) {
            await fileViewerReadRoute.handleTree({ ws, session, message: clientMsg });
          } else {
            try { ws.close(1011, 'file viewer read route unavailable'); } catch (_error) {}
          }
          return;
        }
        if (panelPathRequiresViewReadiness(clientMsg.panel)) {
          await runViewDiscoveryRequest(
            'file_tree_response',
            clientMsg,
            () => fileExplorer.handleFileTreeRequest(ws, clientMsg),
          );
        } else {
          await fileExplorer.handleFileTreeRequest(ws, clientMsg);
        }
        return;
      }

      if (clientMsg.type === 'file_content_request') {
        if (
          clientMsg.panel == null
          || clientMsg.panel === 'file-viewer'
          || Object.prototype.hasOwnProperty.call(clientMsg, 'version')
        ) {
          const fileViewerReadRoute = getFileViewerReadRoute();
          if (fileViewerReadRoute) {
            await fileViewerReadRoute.handleContent({ ws, session, message: clientMsg });
          } else {
            try { ws.close(1011, 'file viewer read route unavailable'); } catch (_error) {}
          }
          return;
        }
        if (panelPathRequiresViewReadiness(clientMsg.panel)) {
          await runViewDiscoveryRequest(
            'file_content_response',
            clientMsg,
            () => fileExplorer.handleFileContentRequest(ws, clientMsg),
          );
        } else {
          await fileExplorer.handleFileContentRequest(ws, clientMsg);
        }
        return;
      }

      if (clientMsg.type === 'recent_files_request') {
        if (panelPathRequiresViewReadiness(clientMsg.panel)) {
          await runViewDiscoveryRequest(
            'recent_files_response',
            clientMsg,
            () => fileExplorer.handleRecentFilesRequest(ws, clientMsg),
          );
        } else {
          await fileExplorer.handleRecentFilesRequest(ws, clientMsg);
        }
        return;
      }

  }

  async function handleMutation(clientMsg) {
      if (clientMsg.type === 'file_save') {
        const fileSaveRoute = getFileSaveRoute();
        if (fileSaveRoute) {
          await fileSaveRoute.handleFileSave({ ws, session, message: clientMsg });
        } else {
          try { ws.close(1011, 'file save route unavailable'); } catch (_error) {}
        }
        return;
      }

      if (clientMsg.type === 'resource:provenance:query') {
        const resourceProvenanceRoute = getResourceProvenanceRoute();
        if (resourceProvenanceRoute) {
          await resourceProvenanceRoute.handleQuery({ ws, session, message: clientMsg });
        } else {
          try { ws.close(1011, 'resource provenance route unavailable'); } catch (_error) {}
        }
        return;
      }

      if (clientMsg.type === 'agent:activity:query') {
        const agentActivityRoute = getAgentActivityRoute();
        if (agentActivityRoute) {
          await agentActivityRoute.handleQuery({ ws, session, message: clientMsg });
        } else {
          try { ws.close(1011, 'agent activity route unavailable'); } catch (_error) {}
        }
        return;
      }

      if (clientMsg.type === 'provenance:test:agent_tool') {
        const fixtureRoute = getAgentToolFixtureRoute();
        if (!fixtureRoute) {
          try { ws.close(1008, 'test fixture route unavailable'); } catch (_error) {}
          return;
        }
        await fixtureRoute.handle({
          ws, session, message: clientMsg, handleCanonicalHarnessEvent,
        });
        return;
      }

      if (clientMsg.type === 'folder_create') {
        await fileExplorer.handleFolderCreateRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'document_create') {
        await fileExplorer.handleDocumentCreateRequest(ws, clientMsg);
        return;
      }

  }

  return { handleRead, handleMutation };
}

module.exports = { createFileRequestDispatch };
