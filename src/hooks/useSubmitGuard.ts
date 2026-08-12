import { useCallback, useRef, useState } from 'react'

/**
 * Stops the same save from being sent twice.
 *
 * A slow connection is the usual cause: nothing visibly happens, so the button
 * gets tapped again, and two identical expenses land. Disabling the button in
 * state is not enough on its own, because a double tap can fire both handlers
 * before React has re-rendered. The ref is what actually closes that window;
 * the state exists so the button can show it is working.
 *
 *   const { submitting, guard } = useSubmitGuard()
 *   <Button loading={submitting} onClick={() => guard(save)} />
 */
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  const guard = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined
    inFlight.current = true
    setSubmitting(true)
    try {
      return await action()
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }, [])

  return { submitting, guard }
}

/**
 * Better Me saves straight to the server. Nothing is queued for later, so a
 * save attempted with no connection simply fails.
 *
 * Saying that plainly before the attempt is more honest than letting it spin
 * and then showing a network error, and much more honest than the third option
 * some apps take: a success toast for something that never left the phone.
 */
export const OFFLINE_MESSAGE =
  'You are offline, so this cannot be saved yet. Your entry stays on screen, so reconnect and tap save again.'

export function isOffline(): boolean {
  // navigator.onLine is only trustworthy in the negative: false really does
  // mean no network. True can still mean a captive portal, which is why the
  // real save is still allowed to fail on its own afterwards.
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
