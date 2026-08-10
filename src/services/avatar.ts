import { supabase } from '@/lib/supabase'

const BUCKET = 'avatars'
const MAX_DIMENSION = 400

/**
 * Downscales and re-encodes the chosen photo in the browser before upload.
 * A modern phone photo is 3-6 MB; this turns it into roughly 30-60 KB, which
 * keeps uploads instant on mobile data and keeps you far inside Supabase's
 * free storage tier.
 *
 * Crops to a centred square so the circular avatar never distorts.
 */
async function compressToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const target = Math.min(MAX_DIMENSION, side)

  const canvas = document.createElement('canvas')
  canvas.width = target
  canvas.height = target
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image on this device.')

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target)
  bitmap.close?.()

  // Prefer WebP; fall back to JPEG on browsers that decline it.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  )
  if (blob) return blob

  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!jpeg) throw new Error('Could not process the image on this device.')
  return jpeg
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }

  const processed = await compressToSquare(file)
  const ext = processed.type === 'image/webp' ? 'webp' : 'jpg'
  // Timestamped filename busts the CDN cache; without it the browser keeps
  // showing the previous photo after a change.
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, processed, { contentType: processed.type, upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = data.publicUrl

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)
  if (profileError) throw new Error(profileError.message)

  // Best effort tidy-up of older photos so storage doesn't grow forever.
  void removeOldAvatars(userId, path)

  return publicUrl
}

async function removeOldAvatars(userId: string, keepPath: string): Promise<void> {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(userId)
    const stale = (data ?? [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keepPath)
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale)
  } catch {
    // Non-fatal: an orphaned file costs a few KB and nothing else.
  }
}

export async function removeAvatar(userId: string): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(userId)
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function getAvatarUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return data.avatar_url ?? null
}
