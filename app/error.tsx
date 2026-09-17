'use client'

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    // main#main-content: the root layout's skip link still renders when this
    // boundary replaces the route tree, so it needs a target here too.
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8"
    >
      <h2 className="text-lg font-medium">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        {error.digest
          ? `Error ID: ${error.digest}`
          : 'An unexpected error occurred.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  )
}
