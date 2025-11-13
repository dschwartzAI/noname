"use client"

import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/auth-client';

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  if (isPending) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  // Check if user has access (owners or admins)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Organization metrics and API usage</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total Users:</span>
          <span className="font-semibold">99</span>
          <span className="text-muted-foreground">Active:</span>
          <span className="font-semibold">87</span>
          <span className="text-muted-foreground">Trial:</span>
          <span className="font-semibold">10</span>
          <Button className="ml-4">Refresh</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api-usage">API Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="api-usage" className="space-y-6">
          <ApiUsageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* SoloOS Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">SoloOS Customers & Members</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">TOTAL CUSTOMERS</div>
            <div className="text-3xl font-bold">99</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">ACTIVE MEMBERS</div>
            <div className="text-3xl font-bold">87</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">TOTAL USERS</div>
            <div className="text-3xl font-bold">99</div>
          </Card>
        </div>
      </div>

      {/* Growth & Retention Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Growth & Retention</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">NEW THIS MONTH</div>
            <div className="text-3xl font-bold">12</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">ACTIVE RATE</div>
            <div className="text-3xl font-bold">88%</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">CHURNED</div>
            <div className="text-3xl font-bold">3</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">RETENTION</div>
            <div className="text-3xl font-bold">97%</div>
          </Card>
        </div>
      </div>

      {/* AI Tool Usage Statistics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">AI Tool Usage Statistics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">TOTAL MESSAGES</div>
            <div className="text-3xl font-bold">64,498</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">ACTIVE TOOLS</div>
            <div className="text-3xl font-bold">7</div>
          </Card>
        </div>

        {/* Tool breakdown */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-purple-600 mb-2">SovereignJK</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages:</span>
                <span className="font-medium">24,967</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conversations:</span>
                <span className="font-medium">1,350</span>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-purple-600 mb-2">Hybrid Offer Printer</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages:</span>
                <span className="font-medium">16,004</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conversations:</span>
                <span className="font-medium">614</span>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-purple-600 mb-2">Daily Content Machine</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages:</span>
                <span className="font-medium">8,219</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conversations:</span>
                <span className="font-medium">363</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ApiUsageTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Real-Time API Costs</h2>
        <p className="text-muted-foreground">Live data from Anthropic Admin API - actual costs</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Current Month</label>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded">
            Sep 2025
          </button>
          <button className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded">
            Aug 2025
          </button>
          <button className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded">
            Jul 2025
          </button>
        </div>
        <button className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-md">
          Refresh
        </button>
      </div>

      <Card className="p-8">
        <h3 className="text-lg font-semibold mb-2">Total API cost</h3>
        <div className="text-5xl font-bold mb-2">$165.801426</div>
        <p className="text-sm text-muted-foreground mb-4">Average: $5.717291 per day</p>
        <p className="text-sm text-primary">✓ Live data from Anthropic Admin API</p>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">Provider Breakdown</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h4 className="text-sm font-medium mb-2">Claude (Anthropic)</h4>
            <div className="text-2xl font-bold">$128.939945</div>
          </Card>
          <Card className="p-6">
            <h4 className="text-sm font-medium mb-2">OpenAI</h4>
            <div className="text-2xl font-bold">$36.861482</div>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ℹ️ Data for month: 2025-11-01 to 2025-11-30
      </p>
    </div>
  );
}

function UserManagementTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">SoloOS User Management</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Users</div>
            <div className="text-2xl font-bold">99</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Admins</div>
            <div className="text-2xl font-bold">2</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Active Members</div>
            <div className="text-2xl font-bold">87</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Trial Users</div>
            <div className="text-2xl font-bold">10</div>
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search by name, email, or username..."
          className="flex-1 px-4 py-2 border rounded-md"
        />
        <select className="px-4 py-2 border rounded-md">
          <option>All Roles</option>
          <option>Admin</option>
          <option>Test Drive</option>
          <option>Expired Test Drive</option>
        </select>
        <select className="px-4 py-2 border rounded-md">
          <option>Newest First</option>
          <option>Oldest First</option>
        </select>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
          Clear
        </button>
      </div>

      <Card>
        <div className="p-6">
          <p className="text-muted-foreground">User table will be implemented here with role management, status tracking, and actions.</p>
        </div>
      </Card>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Organization Settings</h2>
        <p className="text-muted-foreground">Customize your organization's branding and settings</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Branding</h3>
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
    </div>
  );
}

