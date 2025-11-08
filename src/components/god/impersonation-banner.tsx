/**
 * Impersonation Banner - Shows when god user is viewing as an owner
 */

import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/stores/impersonation';
import { AlertCircle, X } from 'lucide-react';

export function ImpersonationBanner() {
  const isImpersonating = useImpersonation((state) => state.isImpersonating);
  const organizationName = useImpersonation((state) => state.organizationName);
  const exitImpersonation = useImpersonation((state) => state.exitImpersonation);

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="bg-yellow-500 text-black px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <div className="flex items-center gap-2">
          <strong className="font-semibold">Viewing as Owner:</strong>
          <span>{organizationName}</span>
        </div>
      </div>
      <Button
        onClick={exitImpersonation}
        variant="outline"
        size="sm"
        className="bg-white hover:bg-gray-100 text-black border-black cursor-pointer"
      >
        <X className="h-4 w-4 mr-2" />
        Exit Impersonation
      </Button>
    </div>
  );
}
