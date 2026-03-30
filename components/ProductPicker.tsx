'use client';

import { ProductMatch } from '@/types';
import { useState } from 'react';
import Image from 'next/image';

interface ProductPickerProps {
  itemId: string;
  itemName: string;
  kroger: ProductMatch[];
  amazon: ProductMatch[];
  onConfirm: (selected: ProductMatch, remember: boolean) => void;
  onCancel: () => void;
}

export function ProductPicker({ itemId, itemName, kroger, amazon, onConfirm, onCancel }: ProductPickerProps) {
  const [selected, setSelected] = useState<ProductMatch | null>(null);
  const [remember, setRemember] = useState(true);

  function handleSelect(product: ProductMatch) {
    setSelected(product);
  }

  function handleConfirm() {
    if (selected) {
      onConfirm(selected, remember);
    }
  }

  return (
    <div className="glass-card" style={{ padding: 'var(--space-xl)', maxWidth: 'lg', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Pick a product for &quot;{itemName}&quot;</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
          This selection will be remembered for future lists.
        </p>
      </header>

      {/* Grid: 2 columns for stores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
        
        {/* King Sooper's Column */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: 'var(--space-md)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'var(--space-sm)' }}>
            KING SOOPERS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {kroger.length === 0 ? (
              <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No products found
              </div>
            ) : (
              kroger.map((p) => (
                <ProductCard 
                  key={p.id} 
                  product={p} 
                  isSelected={selected?.id === p.id} 
                  onClick={() => handleSelect(p)} 
                />
              ))
            )}
          </div>
        </div>

        {/* Amazon Column */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ff9900', marginBottom: 'var(--space-md)', borderBottom: '1px solid rgba(255,153,0,0.2)', paddingBottom: 'var(--space-sm)' }}>
            AMAZON
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {amazon.length === 0 ? (
              <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No products with pricing available
              </div>
            ) : (
              amazon.map((p) => (
                <ProductCard 
                  key={p.id} 
                  product={p} 
                  isSelected={selected?.id === p.id} 
                  onClick={() => handleSelect(p)} 
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Area */}
      <footer style={{ marginTop: 'var(--space-2xl)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input 
            type="checkbox" 
            id="remember_choice" 
            checked={remember} 
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
          />
          <label htmlFor="remember_choice" style={{ fontSize: '1rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Remember this choice for &quot;{itemName}&quot;
          </label>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button className="btn btn-secondary btn-lg" onClick={onCancel}>Cancel</button>
          <button 
            className="btn btn-primary btn-lg" 
            disabled={!selected}
            onClick={handleConfirm}
          >
            ✅ Confirm Selection
          </button>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product, isSelected, onClick }: { product: ProductMatch, isSelected: boolean, onClick: () => void }) {
  const price = product.promo_price ?? product.price;
  
  // Skip products with no price or $0 price
  if (!price || price === 0) {
    return null;
  }

  return (
    <div 
      onClick={onClick}
      className="glass-card animate-scale-in"
      style={{ 
        padding: 'var(--space-md)', 
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
        transform: isSelected ? 'scale(1.02)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        gap: 'var(--space-md)',
        alignItems: 'center'
      }}
    >
      <div style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.5rem' }}>🛒</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {product.name}
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginRight: '2px' }}>$</span>
            {price.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {product.size}
          </div>
        </div>
      </div>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }}></div>}
      </div>
    </div>
  );
}
