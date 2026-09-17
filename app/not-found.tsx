import Link from 'next/link'

export default function NotFound() {
  return (
    // main#main-content: the root layout's skip link renders for unmatched
    // routes too, and Next's default 404 has no target for it.
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8"
    >
      <h2 className="text-lg font-medium">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go home
      </Link>
    </main>
  )
}
