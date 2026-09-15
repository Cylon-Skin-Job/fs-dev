/**
 * @module types/threadGroupMember
 * @role Portable, store-free contract types for the `thread:members` ordered
 *       member projection (SPEC-04 §8).
 *
 * These are durable identities + a bounded display label + a classified
 * placement disposition, never transcript content and never a placement
 * authority. They live in a standalone type module so a portable presentation
 * component (`ThreadRail`) can consume the member contract without importing
 * the panel store or any state slice.
 */

/** Classified placement disposition for one member (`SPEC-04 §8`). */
export type MemberPlacementDisposition = 'absent' | 'open' | 'closed';

/**
 * Ordered member projection from the qualified `thread:members` read
 * (`SPEC-04 §8`). Durable identities + bounded label + placement disposition
 * only; never transcript content.
 */
export interface ThreadMemberProjection {
  threadId: string;
  ordinal: number;
  isPrimary: boolean;
  createdAt: number | string | null;
  label: string;
  placementDisposition: MemberPlacementDisposition | string;
}
