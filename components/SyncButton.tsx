'use client';

interface SyncButtonProps {
  syncing: boolean;
  onSync: () => void;
}

export function SyncButton({ syncing, onSync }: SyncButtonProps) {
  return (
    <button
      className="btn btn-secondary"
      onClick={onSync}
      disabled={syncing}
    >
      {syncing ? '⏳ Syncing...' : '🔄 Sync Grocery List'}
    </button>
  );
}
