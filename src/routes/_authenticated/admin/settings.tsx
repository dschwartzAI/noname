"use client"

import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/auth-client';
import { LogoUpload } from './_components/logo-upload';
import { FaviconUpload } from './_components/favicon-upload';
import { AppNameForm } from './_components/app-name-form';
import { InstructorsManager } from './_components/instructors-manager';

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: AdminSettings,
});

function AdminSettings() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  if (isPending) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <p>Please log in to access the admin panel.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Organization settings, branding, and instructors</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="branding" className="w-full">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="instructors">Instructors</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card className="p-6">
            <div className="space-y-8">
              {/* App Name Section */}
              <div>
                <label className="text-sm font-medium mb-2 block">App Name</label>
                <p className="text-sm text-muted-foreground mb-4">
                  Set the name that appears in browser tabs and across your workspace experience.
                </p>
                <AppNameForm />
              </div>

              <div className="border-t" />

              {/* Logo Section */}
              <div>
                <label className="text-sm font-medium mb-2 block">Logo</label>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your organization's logo. This will be displayed in the sidebar and throughout the app.
                </p>
                <LogoUpload />
              </div>

              <div className="border-t" />

              {/* Favicon Section */}
              <div>
                <label className="text-sm font-medium mb-2 block">Favicon</label>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your browser tab icon. This appears in browser tabs and bookmarks.
                </p>
                <FaviconUpload />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="instructors" className="space-y-6">
          <InstructorsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

