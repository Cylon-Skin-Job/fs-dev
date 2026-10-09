/**
 * @module useListNavigation
 * @role Universal keyboard navigation for lists in modals
 * 
 * Features:
 * - Arrow key navigation (up/down)
 * - Enter to confirm selection
 * - Escape handled by parent modal
 * - Auto-select last item (bottom) on open
 * - Selection synced with hover
 */

import { useState, useEffect, useCallback, type SetStateAction } from 'react';

interface UseListNavigationOptions<T> {
  items: T[];
  isOpen: boolean;
  onSelect: (item: T) => void;
  onClose: () => void;
  /** Select from bottom (true) or top (false) on open. Default: true */
  selectFromBottom?: boolean;
}

interface UseListNavigationReturn<T> {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleItemClick: (item: T) => void;
  handleItemHover: (index: number) => void;
}

export function useListNavigation<T>({
  items,
  isOpen,
  onSelect,
  onClose,
  selectFromBottom = true,
}: UseListNavigationOptions<T>): UseListNavigationReturn<T> {
  const getInitialIndex = useCallback(() => (
    selectFromBottom ? Math.max(items.length - 1, 0) : 0
  ), [items.length, selectFromBottom]);

  const [navigationState, setNavigationState] = useState(() => ({
    selectedIndex: getInitialIndex(),
    isOpen,
    itemCount: items.length,
    selectFromBottom,
  }));

  const navigationContextChanged =
    navigationState.isOpen !== isOpen ||
    navigationState.itemCount !== items.length ||
    navigationState.selectFromBottom !== selectFromBottom;

  let selectedIndex = navigationState.selectedIndex;

  if (navigationContextChanged) {
    selectedIndex = isOpen ? getInitialIndex() : 0;
    setNavigationState({
      selectedIndex,
      isOpen,
      itemCount: items.length,
      selectFromBottom,
    });
  } else if (items.length > 0 && selectedIndex > items.length - 1) {
    selectedIndex = items.length - 1;
    setNavigationState((prev) => ({ ...prev, selectedIndex }));
  } else if (selectedIndex < 0) {
    selectedIndex = 0;
    setNavigationState((prev) => ({ ...prev, selectedIndex }));
  }

  const setSelectedIndex = useCallback((indexOrUpdater: SetStateAction<number>) => {
    setNavigationState((prev) => {
      const nextSelectedIndex = typeof indexOrUpdater === 'function'
        ? indexOrUpdater(prev.selectedIndex)
        : indexOrUpdater;
      return { ...prev, selectedIndex: nextSelectedIndex };
    });
  }, []);

  const setSelectedIndexForConsumer = useCallback((index: number) => {
    setSelectedIndex(index);
  }, [setSelectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex]);
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, items, selectedIndex, onSelect, onClose, setSelectedIndex]);

  const handleItemClick = useCallback((item: T) => {
    onSelect(item);
    onClose();
  }, [onSelect, onClose]);

  const handleItemHover = useCallback((index: number) => {
    setSelectedIndex(index);
  }, [setSelectedIndex]);

  return {
    selectedIndex,
    setSelectedIndex: setSelectedIndexForConsumer,
    handleItemClick,
    handleItemHover,
  };
}
