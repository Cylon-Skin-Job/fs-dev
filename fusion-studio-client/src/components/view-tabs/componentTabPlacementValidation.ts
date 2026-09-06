import { COMPONENT_TAB_LIMITS, type ComponentTabValidationResult } from './componentTabTypes';
import { isBoundedOpaqueId, validateComponentDescriptor } from './componentTabValidation';
import { validateTabLocationProjection } from './componentTabPresentationValidation';
import {
  exactPlacementDataRecord,
  isBoundedPlacementText,
  isPlainPlacementRecord,
  placementEnvelopeFailure,
  validateTabPlacementDisplay,
} from './componentTabPlacementValidationSupport';
import type {
  ResolvedTabPlacementTarget,
  TabPlacementFailure,
  TabPlacementFailureCode,
  TabPlacementRequest,
  TabPlacementResult,
  TabPlacementValidationResult,
} from './componentTabPlacementTypes';

const FAILURE_MESSAGES: Readonly<Record<TabPlacementFailureCode, string>> = Object.freeze({
  invalid_request: 'The tab placement request is invalid.',
  invalid_state: 'The tab collection is not available for placement.',
  target_unavailable: 'The requested target is currently unavailable.',
  target_contract_conflict: 'The requested target could not be placed safely.',
  ambiguous_existing_target: 'The requested target is open more than once.',
  capacity_exceeded: 'No additional tabs can be opened.',
  invalid_generated_id: 'A fresh valid placement identifier is required.',
  id_conflict: 'A placement identifier is already in use.',
  state_commit_failed: 'The tab placement could not be committed.',
});

function isPlacementOpaqueString(value: unknown, maxBytes: number): value is string {
  return isBoundedOpaqueId(value, maxBytes) && isBoundedPlacementText(value, maxBytes);
}

export function createTabPlacementFailure(
  requestId: string | null,
  code: TabPlacementFailureCode,
): TabPlacementFailure {
  return {
    schemaVersion: 1,
    ok: false,
    requestId,
    code,
    message: FAILURE_MESSAGES[code],
  };
}

function recoverRequestId(value: unknown): string | null {
  try {
    if (!isPlainPlacementRecord(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'requestId');
    return descriptor?.enumerable
      && 'value' in descriptor
      && isPlacementOpaqueString(descriptor.value, COMPONENT_TAB_LIMITS.maxIdBytes)
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

export function validateTabPlacementRequest(
  value: unknown,
): TabPlacementValidationResult<TabPlacementRequest> {
  const requestId = recoverRequestId(value);
  try {
    const request = exactPlacementDataRecord(
      value,
      ['schemaVersion', 'requestId', 'disposition', 'target'],
      ['schemaVersion', 'requestId', 'disposition', 'target'],
    );
    if (!request.ok
      || request.value.schemaVersion !== 1
      || !isPlacementOpaqueString(request.value.requestId, COMPONENT_TAB_LIMITS.maxIdBytes)
      || (request.value.disposition !== 'current' && request.value.disposition !== 'new')) {
      return { ok: false, failure: createTabPlacementFailure(requestId, 'invalid_request') };
    }
    const target = exactPlacementDataRecord(
      request.value.target,
      ['presenterId', 'targetKey'],
      ['presenterId', 'targetKey'],
    );
    if (!target.ok
      || !isPlacementOpaqueString(target.value.presenterId, COMPONENT_TAB_LIMITS.maxIdBytes)
      || !isPlacementOpaqueString(target.value.targetKey, COMPONENT_TAB_LIMITS.maxTargetKeyBytes)) {
      return { ok: false, failure: createTabPlacementFailure(requestId, 'invalid_request') };
    }
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        requestId: request.value.requestId,
        disposition: request.value.disposition,
        target: {
          presenterId: target.value.presenterId,
          targetKey: target.value.targetKey,
        },
      },
    };
  } catch {
    return { ok: false, failure: createTabPlacementFailure(requestId, 'invalid_request') };
  }
}

export function validateResolvedTabPlacementTarget(
  value: unknown,
): ComponentTabValidationResult<ResolvedTabPlacementTarget> {
  try {
    const target = exactPlacementDataRecord(
      value,
      ['schemaVersion', 'presenterId', 'targetKey', 'componentTypeId', 'input', 'tab', 'location'],
      ['schemaVersion', 'presenterId', 'targetKey', 'componentTypeId', 'input', 'tab', 'location'],
    );
    if (!target.ok) return target;
    if (target.value.schemaVersion !== 1) {
      return placementEnvelopeFailure(
        'unsupported_schema_version',
        'The resolved target version is unsupported.',
      );
    }
    if (!isPlacementOpaqueString(target.value.presenterId, COMPONENT_TAB_LIMITS.maxIdBytes)
      || !isPlacementOpaqueString(target.value.targetKey, COMPONENT_TAB_LIMITS.maxTargetKeyBytes)) {
      return placementEnvelopeFailure('invalid_id', 'The resolved target identity is invalid.');
    }
    const component = validateComponentDescriptor({
      schemaVersion: 1,
      componentTypeId: target.value.componentTypeId,
      componentInstanceId: 'placement-validation',
      input: target.value.input,
      targetKey: target.value.targetKey,
    });
    if (!component.ok) return component;
    const tab = validateTabPlacementDisplay(target.value.tab, false);
    if (!tab.ok) return tab;
    const location = validateTabLocationProjection(target.value.location);
    if (!location.ok) return location;
    const tabValue = {
      label: tab.value.label,
      icon: tab.value.icon,
      closeLabel: tab.value.closeLabel,
      ...(tab.value.iconClassName ? { iconClassName: tab.value.iconClassName } : {}),
      ...(typeof tab.value.closable === 'boolean' ? { closable: tab.value.closable } : {}),
      ...(typeof tab.value.closeDisabled === 'boolean'
        ? { closeDisabled: tab.value.closeDisabled } : {}),
    };
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        presenterId: target.value.presenterId,
        targetKey: target.value.targetKey,
        componentTypeId: component.value.componentTypeId,
        input: component.value.input,
        tab: tabValue,
        location: location.value,
      },
    };
  } catch {
    return placementEnvelopeFailure('invalid_shape', 'The resolved target is invalid.');
  }
}

export function validateTabPlacementResult(
  value: unknown,
): ComponentTabValidationResult<TabPlacementResult> {
  try {
    const success = value !== null
      && typeof value === 'object'
      && Object.getOwnPropertyDescriptor(value, 'ok')?.value === true;
    const successFields = [
      'schemaVersion', 'ok', 'requestId', 'outcome', 'tabId', 'componentTypeId',
      'componentInstanceId', 'presenterId', 'targetKey', 'reveal',
    ];
    const failureFields = ['schemaVersion', 'ok', 'requestId', 'code', 'message'];
    const base = exactPlacementDataRecord(
      value,
      success ? successFields : failureFields,
      success ? successFields : failureFields,
    );
    if (!base.ok || base.value.schemaVersion !== 1) {
      return placementEnvelopeFailure('invalid_shape', 'The placement result is invalid.');
    }
    if (base.value.ok === true) {
      const outcome = base.value.outcome;
      const reveal = base.value.reveal;
      if (!isPlacementOpaqueString(base.value.requestId, COMPONENT_TAB_LIMITS.maxIdBytes)
        || !isBoundedOpaqueId(base.value.tabId)
        || !isBoundedOpaqueId(base.value.componentTypeId)
        || !isBoundedOpaqueId(base.value.componentInstanceId)
        || !isPlacementOpaqueString(base.value.presenterId, COMPONENT_TAB_LIMITS.maxIdBytes)
        || !isPlacementOpaqueString(base.value.targetKey, COMPONENT_TAB_LIMITS.maxTargetKeyBytes)
        || (outcome !== 'activated_existing' && outcome !== 'filled_current' && outcome !== 'appended_new')
        || (reveal !== 'not_required' && reveal !== 'completed' && reveal !== 'failed')
        || (outcome === 'activated_existing' ? reveal === 'not_required' : reveal !== 'not_required')) {
        return placementEnvelopeFailure('invalid_shape', 'The placement result is invalid.');
      }
      return { ok: true, value: base.value as unknown as TabPlacementResult };
    }
    if (base.value.ok !== false
      || (base.value.requestId !== null
        && !isPlacementOpaqueString(base.value.requestId, COMPONENT_TAB_LIMITS.maxIdBytes))
      || typeof base.value.code !== 'string'
      || !Object.hasOwn(FAILURE_MESSAGES, base.value.code as PropertyKey)
      || !isBoundedPlacementText(base.value.message, COMPONENT_TAB_LIMITS.maxErrorMessageBytes)
      || base.value.message !== FAILURE_MESSAGES[base.value.code as TabPlacementFailureCode]) {
      return placementEnvelopeFailure('invalid_shape', 'The placement result is invalid.');
    }
    return { ok: true, value: base.value as unknown as TabPlacementResult };
  } catch {
    return placementEnvelopeFailure('invalid_shape', 'The placement result is invalid.');
  }
}
