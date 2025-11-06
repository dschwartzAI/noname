import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/auth-client';
import { useState } from 'react';

export const Route = createFileRoute('/_authenticated/admin/god-dashboard')({
  component: GodDashboard,
});

function GodDashboard() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const [creating, setCreating] = useState(false);

  // Show loading while session is being fetched
  if (isPending) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  // Show access denied message if not God
  if (!user?.isGod) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            God Mode requires super admin access.
          </p>
          <div className="space-y-2 text-sm">
            <p><strong>Current User:</strong> {user?.email || 'Not logged in'}</p>
            <p><strong>God Status:</strong> {user?.isGod ? 'Yes' : 'No'}</p>
            <p className="pt-2 text-muted-foreground">
              To access God Mode, you need to login as dschwartz06@gmail.com
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const { data: orgs, isLoading, refetch } = useQuery({
    queryKey: ['god-organizations'],
    queryFn: async () => {
      const res = await fetch('/api/god/organizations');
      if (!res.ok) throw new Error('Failed to fetch organizations');
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['god-stats'],
    queryFn: async () => {
      const res = await fetch('/api/god/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const createTestOrg = async () => {
    setCreating(true);
    try {
      const slug = `test-org-${Date.now()}`;
      const res = await fetch('/api/god/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Organization', slug }),
      });
      if (!res.ok) throw new Error('Failed to create organization');
      refetch();
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">God Dashboard</h1>
          <p className="text-muted-foreground">Manage all coaching programs</p>
        </div>
        <Button onClick={createTestOrg} disabled={creating}>
          {creating ? 'Creating...' : 'Create Test Program'}
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="text-2xl font-bold">{stats.totalPrograms}</div>
            <p className="text-sm text-muted-foreground">Total Programs</p>
          </Card>
          <Card className="p-6">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </Card>
          <Card className="p-6">
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-sm text-muted-foreground">Total Members</p>
          </Card>
        </div>
      )}

      {/* Coaching Programs Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Coaching Programs</h2>
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner/Coach Name</TableHead>
                  <TableHead>Program Name</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs?.organizations?.map((org: any) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{org.ownerName || 'No owner'}</div>
                        <div className="text-xs text-muted-foreground">{org.ownerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{org.programName}</TableCell>
                    <TableCell>{org.memberCount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
