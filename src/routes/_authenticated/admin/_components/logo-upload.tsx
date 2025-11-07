"use client"

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function LogoUpload() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch current organization
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current');
      if (!res.ok) throw new Error('Failed to fetch organization');
      return res.json();
    },
  });

  const currentLogo = orgData?.organization?.logo;

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // First, upload file to R2
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/organization/logo/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadRes.ok) {
        const error = await uploadRes.json().catch(() => ({ error: 'Failed to upload logo' }));
        
        // Special handling for storage not configured
        if (error.error?.includes('Storage not configured')) {
          throw new Error('R2 storage not configured. Please create an R2 bucket named "organization-logos" in your Cloudflare dashboard and add it to wrangler.toml');
        }
        
        throw new Error(error.error || 'Failed to upload logo');
      }
      
      const { url } = await uploadRes.json();
      
      // Then, update organization with the logo URL
      const updateRes = await fetch(`/api/organization/${orgData.organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: url }),
      });
      
      if (!updateRes.ok) {
        throw new Error('Failed to update organization');
      }
      
      return url;
    },
    onSuccess: () => {
      toast.success('Logo uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['organization', 'current'] });
      setFile(null);
      setPreview(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/organization/${orgData.organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: null }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to remove logo');
      }
    },
    onSuccess: () => {
      toast.success('Logo removed successfully');
      queryClient.invalidateQueries({ queryKey: ['organization', 'current'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate(file);
  };

  const handleRemove = () => {
    deleteMutation.mutate();
  };

  const handleCancel = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const displayImage = preview || currentLogo;

  return (
    <div className="space-y-4">
      {/* Current/Preview Image */}
      {displayImage && (
        <div className="relative inline-block">
          <img
            src={displayImage}
            alt="Organization logo"
            className="h-24 w-24 object-contain rounded-lg border border-border bg-muted"
          />
          {!preview && currentLogo && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      )}

      {/* Upload Section */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {!file ? (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Image
          </Button>
        ) : (
          <>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Recommended: Square image, max 5MB. Supports PNG, JPG, SVG.
      </p>
    </div>
  );
}

