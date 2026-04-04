import React, { useEffect, useRef } from 'react';
import { useDebugStore } from '@/store/debugStore';

export function DebugLog() {
  const { messages } = useDebugStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-xs"
    >
      {messages.length === 0 && (
        <span className="text-muted-foreground">No messages</span>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={
            msg.level === 'error'
              ? 'text-red-500'
              : msg.level === 'warn'
              ? 'text-yellow-500'
              : ''
          }
        >
          <span className="text-muted-foreground">[{msg.ts}]</span>{' '}
          {msg.message}
        </div>
      ))}
    </div>
  );
}
