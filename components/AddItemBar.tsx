'use client';

import { useState, useRef } from 'react';
import styles from '../app/page.module.css';

interface AddItemBarProps {
  onAdd: (items: string[]) => void;
}

export function AddItemBar({ onAdd }: AddItemBarProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitItem();
    }
  }

  function submitItem() {
    if (!inputValue.trim()) return;
    onAdd([inputValue.trim()]);
    setInputValue('');
  }

  return (
    <div className={styles.addBar || 'add-bar-fallback'}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <input
            ref={inputRef}
            type="text"
            className="input input-lg"
            placeholder="Add an item... (milk, tp, apples)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            className="btn btn-primary btn-icon"
            onClick={submitItem}
            disabled={!inputValue.trim()}
            style={{ fontSize: '1.4rem', flexShrink: 0 }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
