// Gives every /auth/* page the main landmark that the root layout's
// "Skip to content" link targets.
export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  )
}
