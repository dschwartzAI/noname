"use client"

import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/lib/auth-client';
import { KnowledgeBaseTab } from './_components/knowledge-base-tab';

export const Route = createFileRoute('/_authenticated/admin/knowledge')({
  component: KnowledgeBase,
});

function KnowledgeBase() {
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
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground">Manage organization knowledge bases for AI agents</p>
      </div>

      {/* Knowledge Base Content */}
      <KnowledgeBaseTab />
    </div>
  );
}

