'use client';

import { ReactNode } from 'react';

const DEPT_ICON: Record<string, string> = {
  Produce: 'nutrition',
  Bakery: 'bakery_dining',
  Dairy: 'egg',
  Deli: 'lunch_dining',
  Meat: 'kebab_dining',
  Frozen: 'ac_unit',
  Pantry: 'kitchen',
  Beverages: 'local_cafe',
  Staples: 'push_pin',
  "Today's List": 'list_alt',
  Purchased: 'check_circle',
};

interface DepartmentSectionProps {
  department: string;
  itemCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
  onSelectAll?: () => void;
  allSelected?: boolean;
}

export function DepartmentSection({
  department,
  itemCount,
  children,
  defaultOpen = true,
  onSelectAll,
  allSelected,
}: DepartmentSectionProps) {
  const icon = DEPT_ICON[department] ?? 'shopping_basket';

  return (
    <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] overflow-hidden animate-fade-in">
      {/* Department header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/[0.04] border-b border-primary/10">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1, 'wght' 400" }}
        >
          {icon}
        </span>
        <span
          className="flex-1 text-sm font-semibold text-on-surface"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {department}
        </span>
        {onSelectAll && (
          <button
            onClick={onSelectAll}
            className="text-[11px] font-semibold text-primary hover:text-[#0d4430] transition-colors cursor-pointer bg-transparent border-none px-1 py-0.5 rounded"
          >
            {allSelected ? 'Deselect' : 'Select all'}
          </button>
        )}
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
          {itemCount}
        </span>
      </div>

      {/* Items */}
      {defaultOpen && <div className="divide-y divide-[#edeeef]">{children}</div>}
    </div>
  );
}
