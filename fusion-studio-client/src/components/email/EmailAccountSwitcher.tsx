/**
 * @module EmailAccountSwitcher
 * @role Fake account avatar/dropdown for the Phase 1 email mockup.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { EMAIL_FAKE_ACCOUNTS } from './emailFakeData';
import './EmailAccountSwitcher.css';

function accountAvatarStyle(color: string): CSSProperties {
  return { '--rv-email-account-color': color } as CSSProperties;
}

export function EmailAccountSwitcher() {
  const [selectedAccountId, setSelectedAccountId] = useState(EMAIL_FAKE_ACCOUNTS[0]?.id ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const activeAccount =
    EMAIL_FAKE_ACCOUNTS.find((account) => account.id === selectedAccountId) ??
    EMAIL_FAKE_ACCOUNTS[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && switcherRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!activeAccount) {
    return null;
  }

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsOpen(false);
  };

  const handleAddAccount = () => {
    setIsOpen(false);
  };

  return (
    <div className="rv-email-account-switcher" ref={switcherRef}>
      <button
        type="button"
        className="rv-email-account-button"
        aria-label={`Email account: ${activeAccount.address}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="email-account-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span
          className="rv-email-account-avatar"
          style={accountAvatarStyle(activeAccount.color)}
          aria-hidden="true"
        >
          {activeAccount.initials}
        </span>
        <span className="material-symbols-outlined" aria-hidden="true">arrow_drop_down</span>
      </button>

      <div
        className="rv-dropdown rv-email-account-dropdown"
        id="email-account-menu"
        role="menu"
        data-open={isOpen}
      >
        <div className="rv-email-account-dropdown-header">Mail accounts</div>
        {EMAIL_FAKE_ACCOUNTS.map((account) => {
          const isActive = account.id === activeAccount.id;
          return (
            <button
              key={account.id}
              type="button"
              className={`rv-dropdown-item rv-email-account-option${isActive ? ' rv-email-account-option--active' : ''}`}
              role="menuitemradio"
              aria-checked={isActive}
              onClick={() => handleSelectAccount(account.id)}
            >
              <span
                className="rv-email-account-avatar rv-email-account-avatar--menu"
                style={accountAvatarStyle(account.color)}
                aria-hidden="true"
              >
                {account.initials}
              </span>
              <span className="rv-email-account-option-text">
                <span className="rv-email-account-option-name">{account.name}</span>
                <span className="rv-email-account-option-address">{account.address}</span>
                <span className="rv-email-account-option-provider">{account.provider}</span>
              </span>
              {account.unread > 0 ? (
                <span className="rv-email-account-unread" aria-label={`${account.unread} unread`}>
                  {account.unread}
                </span>
              ) : null}
              {isActive ? (
                <span className="material-symbols-outlined rv-email-account-check" aria-hidden="true">
                  check
                </span>
              ) : null}
            </button>
          );
        })}
        <div className="rv-email-account-separator" role="separator" />
        <button
          type="button"
          className="rv-dropdown-item rv-email-account-add"
          role="menuitem"
          onClick={handleAddAccount}
        >
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          <span>Add account</span>
        </button>
      </div>
    </div>
  );
}
