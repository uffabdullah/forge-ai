/**
 * Optional click tick when Sound is on. Hover is silent.
 */
import { useCallback, useEffect, useState } from 'react'

import {
  isSoundEnabled,
  playUiSound,
  setSoundEnabled,
  unlockAudio,
} from '@/audio/uiSounds.js'

function isSoundTarget(node) {
  if (!(node instanceof Element)) return null
  return node.closest('button, a, [data-sound], [role="button"]')
}

export function useUiSound() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const onClick = (event) => {
      const target = isSoundTarget(event.target)
      if (!target || target.dataset.sound === 'off') return
      playUiSound('click')
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const toggle = useCallback(async () => {
    const next = !isSoundEnabled()
    if (next) await unlockAudio()
    setSoundEnabled(next)
    setEnabled(next)
  }, [])

  return { enabled, toggle, play: playUiSound }
}
