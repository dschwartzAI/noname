import { createFileRoute } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useSession } from '@/lib/auth-client';

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminPanel,
});

function AdminPanel() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  if (isPending) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Business metrics overview</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">465</span>
          <span className="text-muted-foreground">Registered:</span>
          <span className="font-semibold">414</span>
          <span className="text-muted-foreground">Pending:</span>
          <span className="font-semibold">51</span>
          <button className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="overview">Dashboard</TabsTrigger>
          <TabsTrigger value="api-usage">API Usage</TabsTrigger>
          <TabsTrigger value="user-management">User Management</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <OverviewTab />
        </TabsContent>

        {/* API Usage Tab */}
        <TabsContent value="api-usage" className="space-y-6">
          <ApiUsageTab />
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="user-management" className="space-y-6">
          <UserManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Customers Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Customers</h2>
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">SOLO:OS</div>
            <div className="text-3xl font-bold">99</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">CLIENT IN 7</div>
            <div className="text-3xl font-bold">175</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">OFFER CHALLENGE</div>
            <div className="text-3xl font-bold">0</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">SYNDICATE</div>
            <div className="text-3xl font-bold">93</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">SOCIETY</div>
            <div className="text-3xl font-bold">20</div>
          </Card>
        </div>
      </div>

      {/* Clients Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Clients</h2>
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">SOLO:OS</div>
            <div className="text-3xl font-bold">99</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">CLIENT IN 7</div>
            <div className="text-3xl font-bold">175</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">OFFER CHALLENGE</div>
            <div className="text-3xl font-bold">0</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">SYNDICATE</div>
            <div className="text-3xl font-bold">93</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">SOCIETY</div>
            <div className="text-3xl font-bold">20</div>
          </Card>
        </div>
      </div>

      {/* Conversion Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Conversion</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">TOTAL</div>
            <div className="text-3xl font-bold">387</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">CUSTOMERS</div>
            <div className="text-3xl font-bold">274</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">CLIENTS</div>
            <div className="text-3xl font-bold">113</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">CTOC CONVERSION</div>
            <div className="text-3xl font-bold">41%</div>
          </Card>
        </div>
      </div>

      {/* Ascension & Retention Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Ascension & Retention</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">UPGRADES</div>
            <div className="text-3xl font-bold">0</div>
          </Card>
          <Card className="p-6">
            <div className="text-xs text-muted-foreground mb-1">DOWNGRADES</div>
            <div className="text-3xl font-bold">0</div>
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
        <h2 className="text-lg font-semibold mb-4">Manage all user accounts and roles</h2>
        <div className="grid gap-4 md:grid-cols-8">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Users</div>
            <div className="text-2xl font-bold">416</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Admins</div>
            <div className="text-2xl font-bold">4</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Syndicate Users</div>
            <div className="text-2xl font-bold">93</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Society Users</div>
            <div className="text-2xl font-bold">20</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Client in 7</div>
            <div className="text-2xl font-bold">175</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Test Drive</div>
            <div className="text-2xl font-bold">16</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Expired Test Drive</div>
            <div className="text-2xl font-bold">9</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">SOLO:OS Users</div>
            <div className="text-2xl font-bold">99</div>
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
