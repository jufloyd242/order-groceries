'use client';

import { useState, useRef } from 'react';
import styles from '../app/page.module.css';

interface AddItemBarProps {
  onAdd: (items: string[]) => void;
  bulkMode: boolean;
  setBulkMode: (mode: boolean) => void;
}

export function AddItemBar({ onAdd, bulkMode, setBulkMode }: AddItemBarProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitItem();
    }
  }

  function submitItem() {
    if (!inputValue.trim()) return;
    onAdd([inputValue.trim()]);
    setInputValue('');
  }

  function handleBulkAdd() {
    const text = textareaRef.current?.value || '';
    onAdd(text.split('\n'));
    setBulkMode(false);
    setInputValue('');
  }

  return (
    <div className={styles.addBar || "add-bar-fallback"}>
      {bulkMode ? (
        <div style={{ width: '100%' }} className="animate-fade-in">
          <textarea
            ref={textareaRef}
            className="input"
            placeholder="Paste your list here (one item per line)..."
            rows={6}
            autoFocus
            style={{ resize: 'vertical', marginBottom: 'var(--space-sm)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-primary" onClick={handleBulkAdd}>
              ➕ Add All
            </button>
            <button className="btn btn-secondary" onClick={() => setBulkMode(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <input
              ref={inputRef}
              type="text"
              className="input input-lg"
              placeholder="Add items... (milk, tp, apples)"
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
      )}
    </div>
  );
}
