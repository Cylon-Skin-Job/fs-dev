export function observeFixedExchangeDom({ workspaceId, viewId }) {
  const visible = element => Boolean(element && element.getClientRects().length
    && getComputedStyle(element).visibility !== 'hidden'
    && getComputedStyle(element).display !== 'none');
  const hosts = Array.from(document.querySelectorAll('.rv-panel.active [data-chat-host="main"]'))
    .filter(e => e.getAttribute('data-chat-workspace-id') === workspaceId
      && e.getAttribute('data-chat-view-id') === viewId && visible(e));
  const host = hosts.length === 1 ? hosts[0] : null;
  const threadId = host?.getAttribute('data-chat-thread-id') || null;
  const panel = host?.closest('.rv-panel.active');
  const selected = Array.from(panel?.querySelectorAll('[data-thread-id][data-selected="true"]') ?? [])
    .find(e => e.getAttribute('data-thread-id') === threadId);
  const owned = Boolean(host && threadId && selected);
  const users = owned ? Array.from(host.querySelectorAll('.rv-message-user-content')).filter(visible) : [];
  const assistants = owned ? Array.from(host.querySelectorAll('.rv-message-assistant')).filter(visible) : [];
  const matching = assistants.filter(row => Array.from(row.querySelectorAll('.rv-message-assistant-content'))
    .some(content => visible(content) && content.textContent?.trim() === 'CHAT-AR-REPAIR-READY.'));
  const completed = assistants.filter(row => visible(row.querySelector('.rv-assistant-reply-shell'))
    && Array.from(row.querySelectorAll('.rv-message-assistant-content')).some(content => visible(content) && !content.classList.contains('streaming')));
  return { oracleVersion: 3, selectedHostThreadId: owned ? threadId : null,
    selectedHostWorkspaceId: owned ? workspaceId : null, selectedHostViewId: owned ? viewId : null,
    selectedGroupId: owned ? selected.getAttribute('data-thread-group-id') : null,
    fixedPromptVisible: users.some(e => e.textContent?.trim() === 'Reply with exactly CHAT-AR-REPAIR-READY.'),
    fixedResponseVisible: matching.length > 0, completedAssistantVisible: completed.length > 0,
    matchingAssistantRows: matching.length, completedAssistantRows: completed.length };
}
