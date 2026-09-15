/**
 * UI click + optional looping ambient bed.
 * Off until the user turns Sound on. Ambient plays only if
 * `/audio/ambient.mp3` exists (drop the file in frontend/public/audio/).
 */

const AMBIENT_URL = '/audio/ambient.mp3'
const CLICK_PEAK = 0.14
const AMBIENT_VOLUME = 0.34

let ctx = null
let enabled = false
let unlocked = false
let lastClickAt = 0
let ambient = null
let ambientTried = false

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
  if (unlocked && enabled) startAmbient()
  return unlocked
}

export function setSoundEnabled(next) {
  enabled = Boolean(next)
  if (enabled) {
    unlockAudio()
  } else {
    stopAmbient()
  }
  return enabled
}

function startAmbient() {
  if (!enabled || !unlocked) return
  if (ambient) {
    ambient.volume = AMBIENT_VOLUME
    void ambient.play().catch(() => {})
    return
  }
  if (ambientTried) return
  ambientTried = true

  ambient = new Audio(AMBIENT_URL)
  ambient.loop = true
  ambient.preload = 'auto'
  ambient.volume = AMBIENT_VOLUME
  void ambient.play().catch(() => {
    ambient = null
  })
}

function stopAmbient() {
  if (!ambient) return
  ambient.pause()
  ambient.currentTime = 0
}

export function playUiSound(kind) {
  if (!enabled || !unlocked) return
  if (kind !== 'click') return

  const now = performance.now()
  if (now - lastClickAt < 140) return
  lastClickAt = now

  const audio = audioContext()
  if (!audio || audio.state !== 'running') return

  const t0 = audio.currentTime
  const osc = audio.createOscillator()
  const body = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(880, t0)
  osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.09)
  body.type = 'sine'
  body.frequency.setValueAtTime(180, t0)
  body.frequency.exponentialRampToValueAtTime(90, t0 + 0.1)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(CLICK_PEAK, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14)
  osc.connect(amp)
  body.connect(amp)
  amp.connect(audio.destination)
  osc.start(t0)
  body.start(t0)
  osc.stop(t0 + 0.15)
  body.stop(t0 + 0.15)
}
