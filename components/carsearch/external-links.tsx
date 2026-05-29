const externalLinks = [
  {
    title: 'Search Edmunds - Ford',
    desc: 'Mach-E listings around Dallas',
    href: 'https://www.edmunds.com/used-ford-mustang-mach-e-dallas-tx/?radius=200'
  },
  {
    title: 'Search Edmunds - Volvo C40',
    desc: 'C40 Recharge listings',
    href: 'https://www.edmunds.com/used-volvo-c40-recharge-dallas-tx/?radius=200'
  },
  {
    title: 'Search Edmunds - Volvo XC40',
    desc: 'SUV body, similar features',
    href: 'https://www.edmunds.com/used-volvo-xc40-recharge-dallas-tx/?radius=200'
  },
  {
    title: 'Volvo Certified Pre-Owned',
    desc: 'Official CPO inventory',
    href: 'https://cpo.volvocars.us/'
  },
  {
    title: 'Ford Blue Advantage CPO',
    desc: 'Official Ford certified EVs',
    href: 'https://shop.ford.com/cpov2/'
  },
  {
    title: 'Carvana - Mach-E AWD',
    desc: 'Ships nationally, 7-day return',
    href: 'https://www.carvana.com/cars/ford-mustang-mach-e?drive_train[]=AWD'
  }
]

export function CarsearchExternalLinks() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Do not see what you want?
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          These dealer and search sites refresh more often than this page.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {externalLinks.map(link => (
          <a
            aria-label={`${link.title}: ${link.desc}`}
            className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:shadow-sm"
            href={link.href}
            key={link.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="font-semibold text-zinc-950">
              {link.title}{' '}
              <span
                aria-hidden
                className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-800"
              >
                -&gt;
              </span>
            </div>
            <div className="mt-1 text-sm text-zinc-600">{link.desc}</div>
          </a>
        ))}
      </div>
    </section>
  )
}
