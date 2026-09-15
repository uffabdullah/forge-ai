/**
 * Global HUD hover/click sounds. One listener on the document so every
 * button, link, and [data-sound] control ticks without per-component wiring.
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
    let last = null

    const onOver = (event) => {
      const target = isSoundTarget(event.target)
      if (!target || target === last || target.dataset.sound === 'off') return
      last = target
      playUiSound('hover')
    }

    const onOut = (event) => {
      const next = isSoundTarget(event.relatedTarget)
      if (!next) last = null
    }

    const onClick = (event) => {
      const target = isSoundTarget(event.target)
      if (!target || target.dataset.sound === 'off') return
      playUiSound(target.dataset.sound === 'modal' ? 'modal' : 'click')
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('click', onClick)
    const unlock = () => {
      unlockAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('click', onClick)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  const toggle = useCallback(async () => {
    const next = !isSoundEnabled()
    if (next) await unlockAudio()
    setSoundEnabled(next)
    setEnabled(next)
    if (next) playUiSound('click')
  }, [])

  const enable = useCallback(async () => {
    await unlockAudio()
    setSoundEnabled(true)
    setEnabled(true)
  }, [])

  return { enabled, toggle, enable, play: playUiSound }
}
