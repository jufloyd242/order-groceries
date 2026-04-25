'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

interface AddItemBarProps {
  onAdd: (items: string[]) => void;
}

export interface AddItemBarRef {
  focus: () => void;
}

export const AddItemBar = forwardRef<AddItemBarRef, AddItemBarProps>(function AddItemBar({ onAdd }, ref) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submitItem(); }
  }

  function submitItem() {
    if (!inputValue.trim()) return;
    onAdd([inputValue.trim()]);
    setInputValue('');
  }

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-outline mb-2">
        Quick Add
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-surface-container-low border border-[#bfc9c1] rounded-xl px-4 py-3 text-sm text-on-surface placeholder-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)' }}
          placeholder="Add an item… (milk, tp, apples)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          onClick={submitItem}
          disabled={!inputValue.trim()}
          aria-label="Add item"
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center bg-primary text-on-primary rounded-xl shadow-[0_2px_0_0_rgba(0,0,0,0.1)] hover:bg-[#0d4430] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 border-none cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
        </button>
      </div>
    </div>
  );
});
