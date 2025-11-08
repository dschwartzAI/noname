import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSession } from '@/lib/auth-client';
import { useState, useMemo } from 'react';
import { Search, Eye, Ban, Trash2, Mail } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { startImpersonation } from '@/stores/impersonation';

export const Route = createFileRoute('/_authenticated/admin/god-dashboard')({
  component: GodDashboard,
});

function GodDashboard() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean; orgId: string; orgName: string}>({
    show: false,
    orgId: '',
    orgName: '',
  });

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

  // Filter organizations based on search query
  const filteredOrgs = useMemo(() => {
    if (!orgs?.organizations) return [];

    return orgs.organizations.filter((org: any) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        org.programName?.toLowerCase().includes(searchLower) ||
        org.ownerName?.toLowerCase().includes(searchLower) ||
        org.ownerEmail?.toLowerCase().includes(searchLower)
      );
    });
  }, [orgs, searchQuery]);

  const handleViewAsOwner = (orgId: string, orgName: string) => {
    // Start impersonation
    startImpersonation(orgId, orgName);

    // Navigate to the AI chat to show the impersonated view
    navigate({ to: '/ai-chat' });
  };

  const handleSuspendOrg = async (orgId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const res = await fetch(`/api/god/organizations/${orgId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      // Refetch organizations to show updated status
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update organization status');
    }
  };

  const handleDeleteOrg = async () => {
    try {
      const res = await fetch(`/api/god/organizations/${deleteConfirm.orgId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete organization');
      }

      // Close dialog and refetch
      setDeleteConfirm({ show: false, orgId: '', orgName: '' });
      refetch();
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Failed to delete organization');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">God Dashboard</h1>
          <p className="text-muted-foreground">Manage all coaching apps</p>
        </div>
        <Button onClick={createTestOrg} disabled={creating}>
          {creating ? 'Creating...' : 'Create Test App'}
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </Card>
          <Card className="p-6">
            <div className="text-2xl font-bold">{stats.totalOwners}</div>
            <p className="text-sm text-muted-foreground">Total Owners</p>
          </Card>
        </div>
      )}

      {/* Coaching Apps Table */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Coaching Apps</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search apps, owners, emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[300px]"
                />
              </div>
              <Button variant="outline" size="icon" disabled>
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <>
              {filteredOrgs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No apps match your search' : 'No apps found'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner/Coach Name</TableHead>
                      <TableHead>App Name</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.map((org: any) => (
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
                          <Badge
                            variant={org.status === 'active' ? 'default' : 'secondary'}
                          >
                            {org.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleViewAsOwner(org.id, org.programName)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View as Owner
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSuspendOrg(org.id, org.status)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {org.status === 'active' ? 'Suspend' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirm({
                                  show: true,
                                  orgId: org.id,
                                  orgName: org.programName,
                                })}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.show} onOpenChange={(show) =>
        setDeleteConfirm({ ...deleteConfirm, show })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteConfirm.orgName}</strong> and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrg} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
