'use client';

interface SyncButtonProps {
  syncing: boolean;
  onSync: () => void;
}

export function SyncButton({ syncing, onSync }: SyncButtonProps) {
  return (
    <button
      onClick={onSync}
      disabled={syncing}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white text-primary border-2 border-primary/15 rounded-xl hover:bg-primary/5 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
      style={{ boxShadow: 'none' }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '18px', animation: syncing ? 'spin 1s linear infinite' : 'none' }}
      >
        sync
      </span>
      {syncing ? 'Syncing…' : 'Sync List'}
    </button>
  );
}
