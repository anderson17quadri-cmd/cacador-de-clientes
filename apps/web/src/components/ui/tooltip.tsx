'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  content: React.ReactNode;
  setContent: (content: React.ReactNode) => void;
}

const TooltipContext = React.createContext<TooltipContextType | null>(null);

function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState<React.ReactNode>(null);

  return (
    <TooltipContext.Provider value={{ open, setOpen, content, setContent }}>
      {children}
    </TooltipContext.Provider>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [content, setContent] = React.useState<React.ReactNode>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen, content, setContent }}>
      {children}
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(TooltipContext);
  if (!context) return <>{children}</>;

  return (
    <div
      className={cn('inline-flex', className)}
      onMouseEnter={() => context.setOpen(true)}
      onMouseLeave={() => context.setOpen(false)}
    >
      {children}
    </div>
  );
}

function TooltipContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(TooltipContext);
  if (!context) return null;

  React.useEffect(() => {
    context.setContent(children);
  }, [children, context]);

  if (!context.open) return null;

  return (
    <div className={cn(
      'absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
      className,
    )}>
      {children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
