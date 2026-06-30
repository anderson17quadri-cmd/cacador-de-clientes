import * as React from 'react';
import { cn } from '@/lib/utils';

function Tabs({ defaultValue, children, className, value, onValueChange }: {
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internalActive, setInternalActive] = React.useState(defaultValue);
  const active = value !== undefined ? value : internalActive;
  const setActive = onValueChange || setInternalActive;

  return (
    <div className={className} data-active={active}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { active, setActive });
        }
        return child;
      })}
    </div>
  );
}

function TabsList({ children, className, active, setActive }: any) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { active, setActive });
        }
        return child;
      })}
    </div>
  );
}

function TabsTrigger({ value, children, active, setActive }: any) {
  return (
    <button
      type="button"
      onClick={() => setActive?.(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        active === value && 'bg-background text-foreground shadow-sm',
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, active }: any) {
  if (active !== value) return null;
  return <div className="mt-2">{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
