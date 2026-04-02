import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
export function TenantAdmin({ title = "Tenant Settings" }: { title?: string }) {
  return (
    <MainLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">Manage your organization's queues and routing rules.</p>
          </div>
        </div>
        <Tabs defaultValue="queues" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="queues">Queues</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
          </TabsList>
          <TabsContent value="queues" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversation Queues</CardTitle>
                <CardDescription>Configure how chats are distributed across your team.</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] flex items-center justify-center border-2 border-dashed rounded-md m-6 italic text-muted-foreground">
                Configuration interface coming in Phase 3
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workflows" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Automation Workflows</CardTitle>
                <CardDescription>Set up event-driven actions for chat events.</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] flex items-center justify-center border-2 border-dashed rounded-md m-6 italic text-muted-foreground">
                Visual builder coming in Phase 4
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}