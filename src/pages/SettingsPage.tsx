import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GeneralSettings } from '@/pages/settings/GeneralSettings';
import { LabelProfileEditor } from '@/pages/settings/LabelProfileEditor';
import { PrinterProfileEditor } from '@/pages/settings/PrinterProfileEditor';

export function SettingsPage({
  tab = 'general',
  onTabChange,
}: {
  tab?: string;
  onTabChange?: (tab: string) => void;
}) {
  return (
    <div className="p-3 lg:p-4 max-w-7xl mx-auto w-full">
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="label-profiles">Label Profiles</TabsTrigger>
          <TabsTrigger value="printer-profiles">Printer Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="label-profiles">
          <LabelProfileEditor />
        </TabsContent>

        <TabsContent value="printer-profiles">
          <PrinterProfileEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
