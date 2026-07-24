import React from 'react';
import { Bot } from 'lucide-react';

export default function LoadingSkeleton() {
  return (
    <div className="flex gap-3 sm:gap-4 p-4 rounded-2xl bg-white border border-zinc-200 self-start w-full animate-pulse shadow-xs">
      <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 space-y-2 py-1">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-zinc-300 rounded w-32" />
          <div className="h-2 bg-zinc-200 rounded w-12" />
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="h-2.5 bg-zinc-200 rounded w-3/4" />
          <div className="h-2.5 bg-zinc-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}
