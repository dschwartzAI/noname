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
    console.log('🔍 DynamicFavicon: Checking favicon:', favicon);
    
    if (!favicon) {
      console.log('⚠️ DynamicFavicon: No favicon URL found');
      return;
    }

    console.log('🎨 DynamicFavicon: Updating favicon to:', favicon);

    // Update all favicon link elements
    const links = document.querySelectorAll('link[rel*="icon"]');
    console.log('🔗 Found', links.length, 'favicon link elements');
    
    links.forEach(link => {
      (link as HTMLLinkElement).href = favicon;
    });

    // If no favicon links exist, create one
    if (links.length === 0) {
      console.log('➕ Creating new favicon link element');
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.type = 'image/x-icon';
      newLink.href = favicon;
      document.head.appendChild(newLink);
    }
    
    console.log('✅ DynamicFavicon: Update complete');
  }, [orgData?.organization?.favicon]);

  return null; // This component doesn't render anything
}

