import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/(auth)/signup/$token')({
  component: InviteSignup,
});

function InviteSignup() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [programName, setProgramName] = useState('');

  // Validate invite token
  const { data: invite, isLoading: validating, error: validationError } = useQuery({
    queryKey: ['validate-invite', token],
    queryFn: async () => {
      const res = await fetch(`/api/invites/${token}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Invalid invite');
      }
      return res.json();
    },
    retry: false,
  });

  // Accept invite mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (!programName.trim()) {
        throw new Error('App name is required');
      }

      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          password,
          programName,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create account');
      }

      return res.json();
    },
    onSuccess: async () => {
      toast.success('Account created successfully!');

      // Sign in the user
      const signInRes = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invite.email,
          password,
        }),
      });

      if (signInRes.ok) {
        // Redirect to dashboard
        navigate({ to: '/ai-chat' });
      } else {
        // If auto sign-in fails, redirect to sign-in page
        toast.info('Please sign in with your new account');
        navigate({ to: '/sign-in' });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create account');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    acceptMutation.mutate();
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-8 w-full max-w-md">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Validating invite...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-8 w-full max-w-md">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-destructive">Invalid Invite</h2>
            <p className="text-muted-foreground">
              {validationError instanceof Error ? validationError.message : 'This invite link is invalid or has expired.'}
            </p>
            <Button onClick={() => navigate({ to: '/sign-in' })} className="w-full">
              Go to Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="p-8 w-full max-w-md">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">Create Your Coaching App</h1>
            <p className="text-muted-foreground">
              You've been invited to create your white-label AI coaching platform
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{invite?.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={acceptMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="programName">App Name</Label>
              <Input
                id="programName"
                type="text"
                placeholder="My Coaching Program"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                required
                disabled={acceptMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                You can change this any time in your Admin settings
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={acceptMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={acceptMutation.isPending}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={acceptMutation.isPending || password !== confirmPassword || !programName.trim()}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account & Launch App'
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By creating an account, you agree to our terms of service and privacy policy
          </p>
        </div>
      </Card>
    </div>
  );
}
