import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatWidget from '@/components/widget/ChatWidget';
/**
 * WidgetFrame renders ONLY the ChatWidget.
 * Designed to be loaded via an iframe on external sites.
 */
export function WidgetFrame() {
  const [searchParams] = useSearchParams();
  const siteKey = searchParams.get('siteKey');
  if (!siteKey) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 text-xs font-mono">
        Mercury Widget: Missing siteKey
      </div>
    );
  }
  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden">
      <ChatWidget siteKey={siteKey} />
    </div>
  );
}