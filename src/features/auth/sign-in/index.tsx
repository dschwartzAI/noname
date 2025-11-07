import { Link, useSearch, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'
import { useAuth } from '@/stores/auth-simple'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect authenticated users to the app
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: redirect || '/ai-chat', replace: true })
    }
  }, [isAuthenticated, isLoading, redirect, navigate])

  // Show nothing while checking auth status
  if (isLoading) {
    return null
  }

  // Don't show sign-in form if already authenticated
  if (isAuthenticated) {
    return null
  }

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter className='flex flex-col gap-4'>
          <p className='text-muted-foreground text-center text-sm'>
            Don't have an account?{' '}
            <Link
              to='/sign-up'
              search={redirect ? { redirect } : undefined}
              className='hover:text-primary underline underline-offset-4 font-medium'
            >
              Sign up
            </Link>
          </p>
          <p className='text-muted-foreground px-8 text-center text-xs'>
            By clicking sign in, you agree to our{' '}
            <a
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
