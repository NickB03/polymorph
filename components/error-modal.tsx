'use client'

import Link from 'next/link'

import { AlertCircle, Clock, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error: {
    type: 'rate-limit' | 'auth' | 'forbidden' | 'general'
    message: string
    details?: string
  }
  onRetry?: () => void
  onAuthClose?: () => void
}

export function ErrorModal({
  open,
  onOpenChange,
  error,
  onRetry,
  onAuthClose
}: ErrorModalProps) {
  const handleAuthClose = () => {
    onOpenChange(false)
    onAuthClose?.()
  }

  const getErrorIcon = () => {
    switch (error.type) {
      case 'rate-limit':
        return <Clock className="size-6 text-yellow-500" />
      case 'auth':
      case 'forbidden':
        return <AlertCircle className="size-6 text-red-500" />
      default:
        return <AlertCircle className="size-6 text-orange-500" />
    }
  }

  const getErrorTitle = () => {
    switch (error.type) {
      case 'rate-limit':
        return 'Daily limit reached'
      case 'auth':
        return 'Continue with Polymorph'
      case 'forbidden':
        return 'Access Denied'
      default:
        return 'Error Occurred'
    }
  }

  const getErrorDescription = () => {
    switch (error.type) {
      case 'rate-limit':
        return (
          error.message ||
          'You have made too many requests. Please wait a moment before trying again.'
        )
      case 'auth':
        return 'Create a free account to save your search history, upload files, and get unlimited searches.'
      case 'forbidden':
        return 'You do not have permission to access this resource.'
      default:
        return (
          error.message || 'An unexpected error occurred. Please try again.'
        )
    }
  }

  const getErrorDetails = () => {
    if (error.type === 'rate-limit') {
      return 'Your limit resets at midnight UTC. Sign up for a free account to get unlimited searches.'
    }
    return error.details
  }

  const errorDetails = getErrorDetails()

  return (
    <Dialog
      open={open}
      onOpenChange={open => {
        if (!open && error.type === 'auth') {
          handleAuthClose()
        } else {
          onOpenChange(open)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            {getErrorIcon()}
          </div>
          <DialogTitle className="text-center text-xl font-semibold">
            {getErrorTitle()}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {getErrorDescription()}
          </DialogDescription>
          {errorDetails && (
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {errorDetails}
            </div>
          )}
        </DialogHeader>
        <DialogFooter className="flex-col gap-2">
          {error.type === 'auth' || error.type === 'rate-limit' ? (
            <>
              <Button asChild className="w-full">
                <Link href="/auth/sign-up">Create Free Account</Link>
              </Button>
              {error.type === 'auth' ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/login">I already have an account</Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Maybe later
                </Button>
              )}
            </>
          ) : (
            <>
              {onRetry && (
                <Button
                  onClick={() => {
                    onRetry()
                    onOpenChange(false)
                  }}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 size-4" />
                  Try Again
                </Button>
              )}
              <Button
                variant={onRetry ? 'outline' : 'default'}
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
