/**
 * @module useThreadAnimation
 * @role FLIP animation for thread list reordering.
 */

import { useEffect, useCallback, useRef } from 'react';

export function useThreadAnimation(threads: { threadId: string }[]) {
  const threadRefs = useRef<Map<string, HTMLElement>>(new Map());
  const prevOrder = useRef<string[]>([]);
  const cleanupTimerRef = useRef<number | null>(null);

  const setThreadRef = useCallback((threadId: string, el: HTMLElement | null) => {
    if (el) {
      threadRefs.current.set(threadId, el);
    } else {
      threadRefs.current.delete(threadId);
    }
  }, []);

  const scrubInlineStyles = useCallback(() => {
    threadRefs.current.forEach((el) => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      el.style.background = '';
    });
  }, []);

  useEffect(() => {
    const currentOrder = threads.map((t) => t.threadId);
    const prev = prevOrder.current;

    if (prev.length === 0 || JSON.stringify(prev) === JSON.stringify(currentOrder)) {
      prevOrder.current = currentOrder;
      return;
    }

    if (cleanupTimerRef.current != null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
      scrubInlineStyles();
    }

    const positions = new Map<string, { top: number; left: number }>();
    threadRefs.current.forEach((el, threadId) => {
      const rect = el.getBoundingClientRect();
      positions.set(threadId, { top: rect.top, left: rect.left });
    });

    prevOrder.current = currentOrder;

    requestAnimationFrame(() => {
      const animations: { el: HTMLElement; dy: number }[] = [];

      threadRefs.current.forEach((el, threadId) => {
        const oldPos = positions.get(threadId);
        if (!oldPos) return;
        const newRect = el.getBoundingClientRect();
        const dy = oldPos.top - newRect.top;
        if (Math.abs(dy) > 1) {
          animations.push({ el, dy });
        }
      });

      if (animations.length === 0) return;

      const topMover = animations.reduce(
        (max, curr) => (curr.dy > max.dy ? curr : max),
        animations[0],
      );

      animations.forEach(({ el, dy }) => {
        el.style.transform = `translateY(${dy}px)`;
        el.style.transition = 'none';
        el.style.zIndex = '1';
      });

      if (topMover && topMover.dy > 50) {
        topMover.el.style.zIndex = '20';
        topMover.el.style.boxShadow = '0 8px 32px rgba(var(--theme-primary-rgb), 0.15), 0 0 0 1px rgba(var(--theme-primary-rgb), 0.3)';
        topMover.el.style.background = 'rgba(var(--theme-primary-rgb), 0.05)';
      }

      void document.body.offsetHeight;

      requestAnimationFrame(() => {
        animations.forEach(({ el }) => {
          el.style.transition = 'transform 400ms cubic-bezier(0.2, 0, 0.2, 1), box-shadow 400ms ease, background 400ms ease';
          el.style.transform = 'translateY(0)';
        });

        cleanupTimerRef.current = window.setTimeout(() => {
          scrubInlineStyles();
          cleanupTimerRef.current = null;
        }, 400);
      });
    });
  }, [threads, scrubInlineStyles]);

  return { setThreadRef };
}
