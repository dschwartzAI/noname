/**
 * Impersonation Store - God tier organization context switching
 *
 * Allows god users to view the app as if they were an owner of any organization
 * Uses Zustand for simple, reactive state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ImpersonationState {
  isImpersonating: boolean;
  organizationId: string | null;
  organizationName: string | null;
  startImpersonation: (orgId: string, orgName: string) => void;
  exitImpersonation: () => void;
}

export const useImpersonation = create<ImpersonationState>()(
  persist(
    (set) => ({
      isImpersonating: false,
      organizationId: null,
      organizationName: null,

      startImpersonation: (orgId: string, orgName: string) => {
        console.log('🎭 Starting impersonation:', orgName);
        set({
          isImpersonating: true,
          organizationId: orgId,
          organizationName: orgName,
        });
      },

      exitImpersonation: () => {
        console.log('🚪 Exiting impersonation');
        set({
          isImpersonating: false,
          organizationId: null,
          organizationName: null,
        });
      },
    }),
    {
      name: 'god-impersonation', // localStorage key
    }
  )
);

// Export standalone functions for use outside components
export const startImpersonation = (orgId: string, orgName: string) => {
  useImpersonation.getState().startImpersonation(orgId, orgName);
};

export const exitImpersonation = () => {
  useImpersonation.getState().exitImpersonation();
};
