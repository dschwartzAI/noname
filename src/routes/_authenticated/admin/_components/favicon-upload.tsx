"use client"

import { useQuery } from '@tanstack/react-query';
import { ImageUpload } from './image-upload';

export function FaviconUpload() {
  // Fetch current organization
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current');
      if (!res.ok) throw new Error('Failed to fetch organization');
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!orgData?.organization) {
    return <div className="text-sm text-destructive">Organization not found</div>;
  }

  return (
    <ImageUpload
      currentImage={orgData.organization.favicon}
      organizationId={orgData.organization.id}
      fieldName="favicon"
      label="Favicon"
      description="Recommended: 32x32px or 64x64px, max 1MB. ICO, PNG preferred."
      maxSizeMB={1}
      dimensions="32x32px or 64x64px"
    />
  );
}

