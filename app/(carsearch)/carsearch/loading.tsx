export default function CarsearchLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-32 rounded-lg border border-zinc-200 bg-white" />
      <div className="h-20 rounded-lg border border-zinc-200 bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-96 rounded-lg border border-zinc-200 bg-white"
            key={index}
          />
        ))}
      </div>
    </div>
  )
}
