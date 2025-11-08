"use client"

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export function DynamicFavicon() {
  const { data: orgData } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current');
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    const favicon = orgData?.organization?.favicon;

    if (!favicon) {
      return;
    }

    // Update all favicon link elements
    const links = document.querySelectorAll('link[rel*="icon"]');

    links.forEach(link => {
      (link as HTMLLinkElement).href = favicon;
    });

    // If no favicon links exist, create one
    if (links.length === 0) {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.type = 'image/x-icon';
      newLink.href = favicon;
      document.head.appendChild(newLink);
    }
  }, [orgData?.organization?.favicon]);

  return null; // This component doesn't render anything
}

