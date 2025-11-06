import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.DEV ? window.location.origin : window.location.origin,
  // Enable the plugins you need on the client
  plugins: [
    organizationClient(),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  resetPassword,
  sendEmailVerification,
  listSessions,
  revokeSession,
  revokeSessions,
  revokeOtherSessions,
  // Organization methods
  organization,
} = authClient;