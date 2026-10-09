/** Prepared-material insertion branch of the existing app-lifetime Chat action consumer. */
import type { ChatMaterialRequest } from './chat-action';
import { validateChatMaterial, type ChatMaterialOperation } from './chat-material-target';
import { chatComposerDraftOwnerKey, useChatComposerDraftStore } from '../state/chatComposerDraftStore';
import { chatAttachmentOwnerKey, useChatFileLinkStore } from '../state/chatFileLinkStore';

const committed = new WeakMap<ChatMaterialOperation, 'inserted' | 'source_failed'>();
const attachmentKinds = new Set(['file', 'folder', 'wiki', 'ticket', 'doc']);

export function consumeChatMaterial(request: ChatMaterialRequest): void {
  if (typeof request.complete !== 'function' || typeof request.claim !== 'function') return;
  request.claim();
  const { operation, material } = request;
  if (!operation?.owner || !material || typeof material !== 'object') {
    request.complete({ status: 'invalid' }); return;
  }
  const denied = validateChatMaterial(operation);
  if (denied) { request.complete(denied); return; }
  const owner = operation.owner;
  if (committed.has(operation)) {
    request.complete(committed.get(operation) === 'source_failed' ? { status: 'source_failed' } : { status: 'noop', owner });
    return;
  }
  const { workspaceId, threadId } = owner;
  if ('sourceFailure' in material && material.sourceFailure === true && Object.keys(material).length === 1) {
    committed.set(operation, 'source_failed');
    request.complete({ status: 'source_failed' }); return;
  }
  if ('attachment' in material && !('text' in material)) {
    const attachment = material.attachment;
    if (!attachment || !attachmentKinds.has(attachment.kind)
      || !['id', 'label', 'path', 'sourceName'].every((key) => typeof attachment[key as keyof typeof attachment] === 'string'
        && (attachment[key as keyof typeof attachment] as string).length > 0)) {
      request.complete({ status: 'invalid' }); return;
    }
    const store = useChatFileLinkStore.getState(), key = chatAttachmentOwnerKey(workspaceId, threadId);
    const duplicate = store.pendingAttachmentsByOwner[key]?.attachments.some((item) => item.id === attachment.id);
    // No await: exact lifetime/admission check immediately precedes the single owned mutation.
    const unavailable = validateChatMaterial(operation);
    if (unavailable) { request.complete(unavailable); return; }
    committed.set(operation, 'inserted');
    store.addPendingAttachment(workspaceId, threadId, attachment);
    request.complete({ status: duplicate ? 'noop' : 'applied', owner });
    return;
  }
  if (!('text' in material) || 'attachment' in material || typeof material.text !== 'string' || !material.text.length) {
    request.complete({ status: 'invalid' }); return;
  }
  const store = useChatComposerDraftStore.getState(), key = chatComposerDraftOwnerKey(workspaceId, threadId);
  const previous = store.draftsByOwner[key] ?? '', selection = material.selection;
  const safeSelection = selection && selection.surfaceId === owner.surfaceId && selection.generation === owner.generation
    && selection.value === previous && selection.revision === (store.revisionsByOwner[key] ?? 0)
    && Number.isInteger(selection.start) && Number.isInteger(selection.end)
    && selection.start >= 0 && selection.end >= selection.start && selection.end <= previous.length;
  const next = safeSelection
    ? previous.slice(0, selection.start) + material.text + previous.slice(selection.end)
    : previous ? `${previous}\n\n${material.text}` : material.text;
  const unavailable = validateChatMaterial(operation);
  if (unavailable) { request.complete(unavailable); return; }
  committed.set(operation, 'inserted');
  store.setDraft(workspaceId, threadId, next);
  request.complete({ status: 'applied', owner });
}
