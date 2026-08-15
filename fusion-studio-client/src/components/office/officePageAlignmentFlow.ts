/**
 * @module officePageAlignmentFlow
 * @role Consumer-neutral policy for values that follow effective page alignment.
 */
import type { DocumentSettings, DocumentTableAlignment } from '../../lib/front-matter';

export type OfficePageAlignment = DocumentSettings['alignment'];
export type OfficePageAlignmentFlowValue = DocumentTableAlignment;

export type OfficePageAlignmentFlowPlan = {
  oldValue: OfficePageAlignmentFlowValue;
  newValue: OfficePageAlignmentFlowValue;
  values: OfficePageAlignmentFlowValue[];
  changedIndexes: number[];
};

/** Map the four page settings onto the three values supported by flow consumers. */
export function resolveOfficePageAlignmentFlowValue(
  alignment: OfficePageAlignment,
): OfficePageAlignmentFlowValue {
  return alignment === 'right' ? 'right' : alignment === 'left' ? 'left' : 'center';
}

/**
 * Move only values equal to the old effective page value. This deliberately
 * carries no consumer identity or persistent pin state: equality is the whole
 * flow policy, so a value automatically rejoins when the page later matches it.
 */
export function planOfficePageAlignmentFlow(
  oldAlignment: OfficePageAlignment,
  newAlignment: OfficePageAlignment,
  currentValues: readonly OfficePageAlignmentFlowValue[],
): OfficePageAlignmentFlowPlan {
  const oldValue = resolveOfficePageAlignmentFlowValue(oldAlignment);
  const newValue = resolveOfficePageAlignmentFlowValue(newAlignment);
  const changedIndexes: number[] = [];
  const values = currentValues.map((value, index) => {
    if (oldValue === newValue || value !== oldValue) return value;
    changedIndexes.push(index);
    return newValue;
  });
  return { oldValue, newValue, values, changedIndexes };
}
