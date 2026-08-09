/**
 * App Lock: a fast, per-device unlock (PIN or biometrics) that sits in front of
 * an already-authenticated Supabase session, so you don't retype a password
 * every time you open Better Me.
 *
 * SCOPE, HONESTLY: this is a convenience lock, not a second layer of
 * cryptography over your data. The Supabase session token still lives in this
 * browser's local storage, so someone with your unlocked phone AND developer
 * tools could bypass the PIN screen. It stops casual snooping (someone picking
 * up your phone), which is what it is for. Your data is protected from *other
 * users* by Row Level Security on the server, which this does not affect.
 *
 * The PIN itself is never stored. We keep only a PBKDF2-SHA256 hash plus a
 * random salt, so reading local storage does not reveal the PIN.
 */

const PIN_KEY = 'betterme:lock:pin'
const BIOMETRIC_KEY = 'betterme:lock:biometric'
const PBKDF2_ITERATIONS = 210_000

export interface StoredPin {
  saltB64: string
  hashB64: string
  iterations: number
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function derivePinHash(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return bufferToBase64(bits)
}

export function isPinSet(): boolean {
  return localStorage.getItem(PIN_KEY) !== null
}

export function validatePinFormat(pin: string): { valid: boolean; error?: string } {
  if (!/^\d+$/.test(pin)) return { valid: false, error: 'Use digits only.' }
  if (pin.length < 4 || pin.length > 6) return { valid: false, error: 'PIN must be 4 to 6 digits.' }
  if (/^(\d)\1+$/.test(pin)) return { valid: false, error: 'Choose a PIN that is not all the same digit.' }
  if (pin === '1234' || pin === '123456' || pin === '0000') {
    return { valid: false, error: 'That PIN is too easy to guess.' }
  }
  return { valid: true }
}

export async function setPin(pin: string): Promise<void> {
  const salt = new Uint8Array(new ArrayBuffer(16))
  crypto.getRandomValues(salt)
  const hashB64 = await derivePinHash(pin, salt, PBKDF2_ITERATIONS)
  const record: StoredPin = {
    saltB64: bufferToBase64(salt.buffer),
    hashB64,
    iterations: PBKDF2_ITERATIONS,
  }
  localStorage.setItem(PIN_KEY, JSON.stringify(record))
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(PIN_KEY)
  if (!raw) return false
  try {
    const record = JSON.parse(raw) as StoredPin
    const candidate = await derivePinHash(pin, base64ToBuffer(record.saltB64), record.iterations)
    // Constant-time-ish comparison; both strings are the same fixed length.
    if (candidate.length !== record.hashB64.length) return false
    let diff = 0
    for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ record.hashB64.charCodeAt(i)
    return diff === 0
  } catch {
    return false
  }
}

export function clearPin(): void {
  localStorage.removeItem(PIN_KEY)
  clearBiometric()
}

// ---------------------------------------------------------------------------
// Biometrics (WebAuthn platform authenticator: Face ID, Touch ID, fingerprint)
//
// We are not running a WebAuthn verification server, so this is used purely as
// a local "the device confirmed its owner" gate that unlocks an existing
// session. That is the same trust level as the PIN, just more convenient.
// ---------------------------------------------------------------------------

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_KEY) !== null
}

export function clearBiometric(): void {
  localStorage.removeItem(BIOMETRIC_KEY)
}

export async function registerBiometric(username: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isBiometricSupported())) {
    return { success: false, error: 'This device or browser does not support biometric unlock.' }
  }

  try {
    const challenge = new Uint8Array(new ArrayBuffer(32))
    crypto.getRandomValues(challenge)
    const userId = new Uint8Array(new ArrayBuffer(16))
    crypto.getRandomValues(userId)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Better Me', id: window.location.hostname },
        user: { id: userId, name: username, displayName: username },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential) return { success: false, error: 'Biometric setup was cancelled.' }

    localStorage.setItem(
      BIOMETRIC_KEY,
      JSON.stringify({ credentialId: bufferToBase64(credential.rawId), username }),
    )
    return { success: true }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'NotAllowedError') return { success: false, error: 'Biometric setup was cancelled.' }
    return { success: false, error: 'Could not set up biometric unlock on this device.' }
  }
}

export async function verifyBiometric(): Promise<{ success: boolean; error?: string }> {
  const raw = localStorage.getItem(BIOMETRIC_KEY)
  if (!raw) return { success: false, error: 'Biometric unlock is not set up on this device.' }

  try {
    const { credentialId } = JSON.parse(raw) as { credentialId: string }
    const challenge = new Uint8Array(new ArrayBuffer(32))
    crypto.getRandomValues(challenge)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: base64ToBuffer(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })

    if (!assertion) return { success: false, error: 'Biometric check was cancelled.' }
    return { success: true }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'NotAllowedError') return { success: false, error: 'Biometric check was cancelled.' }
    return { success: false, error: 'Biometric unlock failed. Use your PIN.' }
  }
}
