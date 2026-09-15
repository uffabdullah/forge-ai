/**
 * Synthesized HUD audio — hover ticks, clicks, whooshes, a quiet pad.
 *
 * Web Audio only (no third-party samples). Stays silent until unlock() after
 * a user gesture, and while `enabled` is false. Honours prefers-reduced-motion
 * only for the whoosh, not the ticks.
 */

let ctx = null
let enabled = false
let unlocked = false
let lastHoverAt = 0
let ambient = null

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
  if (enabled) {
    unlockAudio().then((ok) => {
      if (ok) startAmbient()
    })
  } else {
    stopAmbient()
  }
  return enabled
}

function tone(audio, { type = 'sine', freq = 880, freqEnd, duration = 0.08, gain = 0.05, delay = 0 }) {
  const t0 = audio.currentTime + delay
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

function noiseBurst(audio, { duration = 0.28, gain = 0.045 }) {
  const t0 = audio.currentTime
  const length = Math.floor(audio.sampleRate * duration)
  const buffer = audio.createBuffer(1, length, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const src = audio.createBufferSource()
  src.buffer = buffer
  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(420, t0)
  filter.frequency.exponentialRampToValueAtTime(1800, t0 + duration)
  const amp = audio.createGain()
  amp.gain.setValueAtTime(gain, t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  src.connect(filter)
  filter.connect(amp)
  amp.connect(audio.destination)
  src.start(t0)
  src.stop(t0 + duration)
}

export function playUiSound(kind) {
  if (!enabled || !unlocked) return
  const audio = audioContext()
  if (!audio || audio.state !== 'running') return

  if (kind === 'hover') {
    const now = performance.now()
    if (now - lastHoverAt < 70) return
    lastHoverAt = now
    tone(audio, { type: 'triangle', freq: 1240, freqEnd: 1860, duration: 0.07, gain: 0.035 })
    return
  }

  if (kind === 'click') {
    tone(audio, { type: 'sine', freq: 420, freqEnd: 180, duration: 0.11, gain: 0.06 })
    tone(audio, { type: 'triangle', freq: 980, duration: 0.05, gain: 0.03, delay: 0.02 })
    return
  }

  if (kind === 'modal') {
    tone(audio, { type: 'sine', freq: 220, freqEnd: 110, duration: 0.22, gain: 0.05 })
    noiseBurst(audio, { duration: 0.2, gain: 0.03 })
    return
  }

  if (kind === 'whoosh') {
    noiseBurst(audio, { duration: 0.42, gain: 0.055 })
    tone(audio, { type: 'sine', freq: 160, freqEnd: 70, duration: 0.5, gain: 0.04 })
  }
}

function startAmbient() {
  const audio = audioContext()
  if (!audio || ambient || !enabled || !unlocked) return

  const make = (freq, type) => {
    const osc = audio.createOscillator()
    const amp = audio.createGain()
    osc.type = type
    osc.frequency.value = freq
    amp.gain.value = 0.012
    osc.connect(amp)
    amp.connect(audio.destination)
    osc.start()
    return { osc, amp }
  }

  ambient = [make(92, 'sine'), make(138, 'triangle')]
}

function stopAmbient() {
  if (!ambient) return
  for (const node of ambient) {
    try {
      node.amp.gain.exponentialRampToValueAtTime(0.0001, (ctx?.currentTime ?? 0) + 0.2)
      node.osc.stop((ctx?.currentTime ?? 0) + 0.25)
    } catch {
      /* already stopped */
    }
  }
  ambient = null
}
