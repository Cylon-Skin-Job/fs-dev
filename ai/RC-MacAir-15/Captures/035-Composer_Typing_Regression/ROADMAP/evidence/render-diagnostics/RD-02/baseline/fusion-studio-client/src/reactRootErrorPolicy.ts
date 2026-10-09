import type { RootOptions } from 'react-dom/client';

export const CAUGHT_RENDER_ERROR_CODE = '[Fusion Studio] A component error was contained.';

/** Reports caught React errors without forwarding caller-supplied diagnostics. */
export const reactRootErrorOptions = {
  onCaughtError: () => {
    console.error(CAUGHT_RENDER_ERROR_CODE);
  },
} satisfies RootOptions;
