import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface AgentIconUploadProps {
  currentIcon?: string | null;
  currentEmoji?: string | null;
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
}

export function AgentIconUpload({
  currentIcon,
  currentEmoji,
  onUploadComplete,
  onRemove,
}: AgentIconUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (2MB max)
    if (selectedFile.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
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

  const handleUpload = async () => {
    if (!file) return;

    try {
      setIsUploading(true);

      // Upload to R2
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/agents/icon/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json().catch(() => ({ error: 'Failed to upload icon' }));
        throw new Error(error.error || 'Failed to upload icon');
      }

      const { url } = await uploadRes.json();

      toast.success('Icon uploaded successfully');
      onUploadComplete(url);
      setFile(null);
      setPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload icon');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  const displayImage = preview || currentIcon;

  return (
    <div className="space-y-3">
      {/* Current/Preview Image */}
      <div className="flex items-center gap-3">
        {displayImage ? (
          <div className="relative">
            <img
              src={displayImage}
              alt="Agent icon"
              className="h-16 w-16 object-cover rounded-lg border border-border bg-muted"
            />
            {!preview && currentIcon && onRemove && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                onClick={handleRemove}
                type="button"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ) : currentEmoji ? (
          <div className="h-16 w-16 flex items-center justify-center text-4xl border rounded-lg bg-muted">
            {currentEmoji}
          </div>
        ) : (
          <div className="h-16 w-16 flex items-center justify-center border rounded-lg bg-muted text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}

        {/* Upload Controls */}
        <div className="flex-1">
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
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Upload className="mr-2 h-4 w-4" />
              {currentIcon || currentEmoji ? 'Change Icon' : 'Upload Icon'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={isUploading}
                type="button"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isUploading}
                type="button"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Square image recommended, max 2MB. Supports PNG, JPG, SVG.
      </p>
    </div>
  );
}
