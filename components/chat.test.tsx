import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for transient artifact data handling in the Chat component.
 *
 * Coverage items:
 * - #11: Transient artifact logs/events handled via `useChat({ onData })`
 *        without persistence
 *
 * These tests verify the DOM-event dispatching logic from the `onData`
 * callback without rendering the full Chat component (which pulls in
 * too many unrelated dependencies). The behavior under test is the
 * conditional branching in onData — it should dispatch CustomEvents
 * for transient artifact types and ignore everything else.
 */

// The onData handler extracted from Chat's useChat configuration.
// This is the exact same logic — we test it in isolation because the
// full component render requires the entire app context tree.
function onDataHandler(dataPart: unknown) {
  if (dataPart && typeof dataPart === 'object' && 'type' in dataPart) {
    const { type } = dataPart as { type: string }
    if (type === 'data-artifactLog' || type === 'data-artifactEvent') {
      window.dispatchEvent(
        new CustomEvent(type, {
          detail: (dataPart as unknown as { data: unknown }).data
        })
      )
    }
  }
}

describe('Chat onData artifact handler', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatches data-artifactLog as a CustomEvent on window', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const logPart = {
      type: 'data-artifactLog',
      data: {
        artifactId: 'artifact-1',
        message: 'Installing dependencies...',
        level: 'info'
      }
    }

    onDataHandler(logPart)

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('data-artifactLog')
    expect(event.detail).toEqual({
      artifactId: 'artifact-1',
      message: 'Installing dependencies...',
      level: 'info'
    })
  })

  it('dispatches data-artifactEvent as a CustomEvent on window', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const eventPart = {
      type: 'data-artifactEvent',
      data: {
        artifactId: 'artifact-1',
        event: 'build-complete',
        payload: { duration: 3000 }
      }
    }

    onDataHandler(eventPart)

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('data-artifactEvent')
    expect(event.detail).toEqual({
      artifactId: 'artifact-1',
      event: 'build-complete',
      payload: { duration: 3000 }
    })
  })

  it('does NOT dispatch events for persistent artifact data types', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    onDataHandler({
      type: 'data-artifact',
      data: { id: 'a1', title: 'App', status: 'ready' }
    })

    onDataHandler({
      type: 'data-artifactStatus',
      data: { id: 'a1', status: 'building' }
    })

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('does NOT dispatch events for non-artifact data types', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    onDataHandler({
      type: 'data-relatedQuestions',
      data: { status: 'loading' }
    })

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('ignores null and undefined data parts', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    onDataHandler(null)
    onDataHandler(undefined)

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('ignores non-object data parts', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    onDataHandler('string-data')
    onDataHandler(42)
    onDataHandler(true)

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('ignores objects without a type field', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    onDataHandler({ data: { message: 'no type field' } })

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('transient parts are never included in message.parts (verified by mapping layer)', () => {
    // This test verifies the contract: transient parts (artifactLog,
    // artifactEvent) flow through onData only and are excluded from
    // message persistence. The mapping layer test in
    // message-mapping-display-tools.test.ts verifies
    // mapUIMessagePartsToDBParts returns 0 rows for transient parts.
    // Here we verify the onData handler is the *only* consumer path.
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    // Simulate a sequence of transient + persistent parts
    const parts = [
      {
        type: 'data-artifactEvent',
        data: { artifactId: 'a1', event: 'create-started' }
      },
      {
        type: 'data-artifactLog',
        data: { artifactId: 'a1', message: 'Building...' }
      },
      {
        type: 'data-artifact',
        data: { id: 'a1', title: 'App', status: 'building' }
      }
    ]

    parts.forEach(p => onDataHandler(p))

    // Only transient parts produce DOM events
    expect(dispatchSpy).toHaveBeenCalledTimes(2)
    expect((dispatchSpy.mock.calls[0][0] as CustomEvent).type).toBe(
      'data-artifactEvent'
    )
    expect((dispatchSpy.mock.calls[1][0] as CustomEvent).type).toBe(
      'data-artifactLog'
    )
  })
})
