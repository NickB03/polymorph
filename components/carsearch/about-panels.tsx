const panels = [
  {
    title: 'How we picked these cars',
    body: [
      'We searched within 200 miles of Dallas for used AWD electric vehicles from Volvo, Ford, and Polestar.',
      'Volvo Ultimate trims get Pilot Assist. Ford Premium and GT trims are prioritized for BlueCruise. Polestar listings need feature verification.'
    ]
  },
  {
    title: 'What to verify before buying',
    body: [
      'Confirm the safety system on the window sticker or dealer build sheet.',
      'Run a CARFAX or AutoCheck report and skip lemon-branded vehicles.',
      'Check tire wear, battery health, warranty coverage, and charging equipment before committing.'
    ]
  },
  {
    title: 'About home charging',
    body: [
      'At about 100 miles a day, a Level 2 home charger matters. A 240V setup usually covers the daily commute overnight.',
      'Every car on this list can use standard Level 2 charging equipment.'
    ]
  },
  {
    title: 'How Recommended sort works',
    body: [
      'The score adds weight for top picks, confirmed assist, AWD, CPO warranty, nearby inventory, and range above 240 miles.',
      'Mileage subtracts a small amount so lower-mile examples rise when the rest of the car is similar.'
    ]
  }
]

export function CarsearchAboutPanels() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="grid gap-3 lg:grid-cols-2">
        {panels.map(panel => (
          <details
            className="rounded-lg border border-zinc-200 bg-white p-4"
            key={panel.title}
          >
            <summary className="cursor-pointer text-base font-semibold text-zinc-950">
              {panel.title}
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-600">
              {panel.body.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
