/**
 * Optional UI click — one short, quiet tick. No hover spam, no ambient pad.
 * Off until the user turns Sound on.
 */

let ctx = null
let enabled = false
let unlocked = false
let lastClickAt = 0

function audioContext() {
  if (ctx) return ctx
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

export function isSoundEnabled() {
  return enabled && unlocked
}

export async function unlockAudio() {
  const audio = audioContext()
  if (!audio) return false
  if (audio.state === 'suspended') {
    try {
      await audio.resume()
    } catch {
      return false
    }
  }
  unlocked = audio.state === 'running'
  return unlocked
}

export function setSoundEnabled(next) {
  enabled = Boolean(next)
  if (enabled) unlockAudio()
  return enabled
}

export function playUiSound(kind) {
  if (!enabled || !unlocked) return
  if (kind !== 'click') return

  const now = performance.now()
  if (now - lastClickAt < 180) return
  lastClickAt = now

  const audio = audioContext()
  if (!audio || audio.state !== 'running') return

  const t0 = audio.currentTime
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, t0)
  osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.07)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(0.018, t0 + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + 0.1)
}
