import React from 'react';
import { clsx } from 'clsx';

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div role="tablist" className={clsx('border-b border-v26-line flex items-center overflow-x-auto gap-1', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'px-4 h-12 text-base transition-colors whitespace-nowrap flex items-center gap-2 border-b-[3px] -mb-[1px]',
              isActive
                ? 'border-v26-red text-v26-ink font-bold'
                : 'border-transparent text-v26-muted hover:text-v26-ink'
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'min-w-[1.75rem] px-1.5 py-0.5 text-sm text-center',
                  isActive ? 'bg-v26-red text-white' : 'bg-v26-soft text-v26-muted'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
