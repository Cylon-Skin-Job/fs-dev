/**
 * @module Toast
 * @role React mount point for toast notifications
 *
 * The imperative showToast() function lives in lib/toast.ts.
 * This component registers its state setter on mount so showToast() works.
 */

import { useState, useEffect } from 'react';
import { registerToastSetter, unregisterToastSetter } from '../lib/toast';
import './Toast.css';

// Re-export for existing consumers
export { showToast } from '../lib/toast';

export function Toast() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    registerToastSetter((msg: string) => {
      setMessage(msg);
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    });
    return () => { unregisterToastSetter(); };
  }, []);

  if (!visible) return null;

  return <div className="rv-toast">{message}</div>;
}
