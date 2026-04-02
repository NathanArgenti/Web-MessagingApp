import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
export function AgentConsole() {
  return (
    <MainLayout>
      <div className="h-full flex flex-col">
        <div className="border-b bg-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Workspace</h2>
            <Badge variant="outline" className="text-cyan-600 bg-cyan-50">3 Active Chats</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="presence">Available</Label>
            <Switch id="presence" defaultChecked />
          </div>
        </div>
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* Queues/Inboxes */}
          <div className="col-span-3 border-r bg-slate-50/50 p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Queues</h3>
            <Card className="p-3 cursor-pointer hover:bg-white border-cyan-200 bg-white">
              <p className="text-sm font-medium">General Support</p>
              <p className="text-xs text-muted-foreground">2 waiting</p>
            </Card>
          </div>
          {/* Active Chat Area */}
          <div className="col-span-6 flex flex-col bg-white">
            <div className="flex-1 flex items-center justify-center text-muted-foreground italic">
              Select a conversation to start chatting
            </div>
            <div className="p-4 border-t bg-slate-50">
              <div className="h-10 bg-white rounded border flex items-center px-3 text-slate-400 text-sm">
                Type a message...
              </div>
            </div>
          </div>
          {/* Contact Details */}
          <div className="col-span-3 border-l bg-slate-50/50 p-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Contact Information</h3>
             <div className="text-center py-8">
               <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-4" />
               <p className="text-sm text-muted-foreground">No contact selected</p>
             </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}