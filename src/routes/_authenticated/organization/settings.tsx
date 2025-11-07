import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/_authenticated/organization/settings')({
  component: OrganizationSettings,
});

function OrganizationSettings() {
  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['current-organization'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current');
      if (!res.ok) throw new Error('Failed to fetch organization');
      const data = await res.json();
      return data.organization;
    },
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['organization-members', org?.id],
    queryFn: async () => {
      if (!org?.id) return { members: [] };
      const res = await fetch(`/api/organization/${org.id}/members`);
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
    enabled: !!org?.id,
  });

  if (orgLoading) {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  if (!org) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">No Organization</h2>
          <p className="text-muted-foreground">You are not a member of any organization yet.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{org.name}</h1>
        <p className="text-muted-foreground">Organization Settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">General Information</h3>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input id="name" value={org.name} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" value={org.slug} disabled />
                <p className="text-sm text-muted-foreground">URL: /{org.slug}</p>
              </div>
              <div className="grid gap-2">
                <Label>Tier</Label>
                <Badge className="w-fit">{org.metadata?.tier || 'free'}</Badge>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Members</h3>
              {org.role === 'owner' && <Button size="sm">Invite Member</Button>}
            </div>
            {membersLoading ? (
              <p>Loading members...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    {(org.role === 'owner' || org.role === 'admin') && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersData?.members?.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.userName}</TableCell>
                      <TableCell>{member.userEmail}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </TableCell>
                      {(org.role === 'owner' || org.role === 'admin') && member.role !== 'owner' && (
                        <TableCell>
                          <Button variant="ghost" size="sm">Remove</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Branding</h3>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <Input
                  id="primaryColor"
                  type="color"
                  value={org.metadata?.primaryColor || '#000000'}
                  disabled={org.role !== 'owner'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={org.metadata?.companyName || ''}
                  placeholder="Your Company"
                  disabled={org.role !== 'owner'}
                />
              </div>
              {org.role === 'owner' && (
                <Button>Save Changes</Button>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
