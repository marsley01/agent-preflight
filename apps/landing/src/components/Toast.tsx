import React from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div
      className="fixed bottom-6 right-6 px-space-md py-2.5 rounded-xl bg-inverse-surface text-inverse-on-surface font-body-sm text-body-sm shadow-xl flex items-center gap-space-sm transition-all duration-200 z-50 animate-bounce"
      onClick={onClose}
    >
      <span className="material-symbols-outlined text-[16px] text-tertiary-fixed">check_circle</span>
      <span>{message}</span>
    </div>
  );
};