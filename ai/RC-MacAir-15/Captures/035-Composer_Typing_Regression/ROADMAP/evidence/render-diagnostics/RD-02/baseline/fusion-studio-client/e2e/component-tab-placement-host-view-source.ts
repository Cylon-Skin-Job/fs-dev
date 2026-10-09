/** Emits the rendered source controls and stable public evidence surface for the virtual host. */
export function placementHostViewSource(): string {
  return `
      function ResultPanel() {
        const adapter = React.useSyncExternalStore(
          testApi.subscribe,
          testApi.getSnapshot,
          testApi.getSnapshot,
        );
        const currentResult = result;
        const active = activeRecord();
        return React.createElement(
          React.Fragment,
          null,
          React.createElement('nav', { 'aria-label': 'Placement sources' },
            sourceNames.map((sourceName) => React.createElement('button', {
              key: sourceName,
              type: 'button',
              onClick: () => { void invokeSource(sourceName); },
            }, sourceName + ' open target')),
          ),
          React.createElement('section', {
            'aria-label': 'Placement result',
            role: currentResult?.ok === false ? 'alert' : 'status',
          }, currentResult
            ? currentResult.ok
              ? 'Placement succeeded: ' + currentResult.outcome
                + '; tab ' + currentResult.tabId
                + '; target ' + currentResult.presenterId + ' / ' + currentResult.targetKey
                + '; reveal ' + currentResult.reveal
              : 'Placement failed: ' + currentResult.code + '; ' + currentResult.message
            : 'No placement result'),
          React.createElement('output', { 'data-testid': 'active-identity' },
            'Active tab ' + state.activeTabId
              + '; presenter ' + (active?.shell?.presenterId ?? 'none')
              + '; target ' + (active?.content?.component?.targetKey ?? 'none')),
          React.createElement('pre', { 'data-testid': 'placement-state' }, JSON.stringify(summarize())),
          React.createElement(ViewTabBar, { panel: 'placement-host-fixture' },
            React.createElement('p', null, 'Legacy placement content must not render')),
        );
      }

      createRoot(document.querySelector('#placement-root'), reactRootErrorOptions).render(
        React.createElement(ResultPanel),
      );`;
}

