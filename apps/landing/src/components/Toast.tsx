import React from 'react';
import { Icon } from './Icon';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => (
  <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
    {message && (
      <button
        type="button"
        onClick={onClose}
        className="fade-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-inverse-surface px-4 py-2.5 text-left font-body-sm text-inverse-on-surface shadow-lg shadow-black/10"
      >
        <Icon name="check-circle" size={16} weight="fill" className="text-status-pass" />
        <span>{message}</span>
      </button>
    )}
  </div>
);
