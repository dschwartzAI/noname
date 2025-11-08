import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from '@/lib/auth-client';
import { useState, useMemo } from 'react';
import { Search, Eye, Ban, Trash2, Mail, UserPlus, Send, X, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { startImpersonation } from '@/stores/impersonation';

export const Route = createFileRoute('/_authenticated/admin/god-dashboard')({
  component: GodDashboard,
});

function GodDashboard() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<('active' | 'suspended' | 'deleted')[]>(['active', 'suspended', 'deleted']);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
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

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['god-stats'],
    queryFn: async () => {
      const res = await fetch('/api/god/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: invites, refetch: refetchInvites } = useQuery({
    queryKey: ['god-invites'],
    queryFn: async () => {
      const res = await fetch('/api/god/invites');
      if (!res.ok) throw new Error('Failed to fetch invites');
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/god/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send invite');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Invite sent successfully!');
      setInviteDialogOpen(false);
      setInviteEmail('');
      refetchInvites();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invite');
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/god/invites/${inviteId}/resend`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to resend invite');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Invite resent successfully!');
      refetchInvites();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resend invite');
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/god/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to revoke invite');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Invite revoked successfully!');
      refetchInvites();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke invite');
    },
  });

  const handleSendInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    inviteMutation.mutate(inviteEmail);
  };

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

  // Filter organizations based on search query and status filter
  const filteredOrgs = useMemo(() => {
    if (!orgs?.organizations) return [];

    return orgs.organizations.filter((org: any) => {
      // Filter by status (only show orgs with status in the filter array)
      if (!statusFilter.includes(org.status)) {
        return false;
      }

      // Filter by search query
      const searchLower = searchQuery.toLowerCase();
      return (
        org.programName?.toLowerCase().includes(searchLower) ||
        org.ownerName?.toLowerCase().includes(searchLower) ||
        org.ownerEmail?.toLowerCase().includes(searchLower)
      );
    });
  }, [orgs, searchQuery, statusFilter]);

  // Filter invites to only show pending and expired (hide used/claimed)
  const pendingInvites = useMemo(() => {
    if (!invites?.invites) return [];
    return invites.invites.filter((invite: any) => invite.status !== 'used');
  }, [invites]);

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

      // Close dialog and refetch both orgs and stats
      setDeleteConfirm({ show: false, orgId: '', orgName: '' });
      refetch();
      refetchStats();
      toast.success('Organization deleted successfully');
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error('Failed to delete organization');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">God Dashboard</h1>
          <p className="text-muted-foreground">Manage all coaching apps</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setInviteDialogOpen(true)} variant="outline">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Owner
          </Button>
          <Button onClick={createTestOrg} disabled={creating}>
            {creating ? 'Creating...' : 'Create Test App'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <p className="text-sm text-muted-foreground">Total Members</p>
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
            <h2 className="text-xl font-semibold">Owners</h2>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Status: {statusFilter.length === 3 ? 'All' : statusFilter.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    onClick={() => {
                      const allStatuses: ('active' | 'suspended' | 'deleted')[] = ['active', 'suspended', 'deleted'];
                      setStatusFilter(statusFilter.length === 3 ? [] : allStatuses);
                    }}
                  >
                    <Checkbox checked={statusFilter.length === 3} className="mr-2" />
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    onClick={() => {
                      setStatusFilter(prev =>
                        prev.includes('active')
                          ? prev.filter(s => s !== 'active')
                          : [...prev, 'active']
                      );
                    }}
                  >
                    <Checkbox checked={statusFilter.includes('active')} className="mr-2" />
                    Active
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    onClick={() => {
                      setStatusFilter(prev =>
                        prev.includes('suspended')
                          ? prev.filter(s => s !== 'suspended')
                          : [...prev, 'suspended']
                      );
                    }}
                  >
                    <Checkbox checked={statusFilter.includes('suspended')} className="mr-2" />
                    Suspended
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    onClick={() => {
                      setStatusFilter(prev =>
                        prev.includes('deleted')
                          ? prev.filter(s => s !== 'deleted')
                          : [...prev, 'deleted']
                      );
                    }}
                  >
                    <Checkbox checked={statusFilter.includes('deleted')} className="mr-2" />
                    Deleted
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites">
          <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Owner Invites</h2>
              <p className="text-sm text-muted-foreground">Track and manage pending invitations</p>
            </div>
          </div>

          {pendingInvites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending invites. Click "Invite Owner" to send a new invite.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite: any) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invite.status === 'used' ? 'default' :
                          invite.status === 'expired' ? 'secondary' :
                          'outline'
                        }
                      >
                        {invite.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                        {invite.status === 'used' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {invite.status === 'expired' && <XCircle className="mr-1 h-3 w-3" />}
                        {invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{invite.createdBy?.name}</div>
                      <div className="text-xs text-muted-foreground">{invite.createdBy?.email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {invite.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resendInviteMutation.mutate(invite.id)}
                            disabled={resendInviteMutation.isPending}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => revokeInviteMutation.mutate(invite.id)}
                            disabled={revokeInviteMutation.isPending}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Revoke
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Expired</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
        </TabsContent>
      </Tabs>

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

      {/* Invite Owner Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Owner</DialogTitle>
            <DialogDescription>
              Send an invitation to create a new white-label coaching app. The recipient will receive an email with setup instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="coach@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendInvite();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
