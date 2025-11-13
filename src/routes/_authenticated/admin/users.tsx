"use client"

import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/lib/auth-client';

export const Route = createFileRoute('/_authenticated/admin/users')({
  component: UserManagement,
});

function UserManagement() {
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
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage organization users and permissions</p>
      </div>

      {/* Stats */}
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Search by name, email, or username..."
          className="flex-1"
        />
        <Select defaultValue="all-roles">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-roles">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="test-drive">Test Drive</SelectItem>
            <SelectItem value="expired">Expired Test Drive</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="newest">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Newest First" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">Clear</Button>
      </div>

      {/* User Table */}
      <Card>
        <div className="p-6">
          <p className="text-muted-foreground">User table will be implemented here with role management, status tracking, and actions.</p>
        </div>
      </Card>
    </div>
  );
}

