'use client'

import { useRef, useState } from 'react'
import { AtSign, Camera, Loader2, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/features/auth/auth-provider'
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability'
import { updatePublicProfile } from '@/services/profile'
import { uploadAvatar, deleteStorageObject } from '@/services/storage'
import { changeUsername } from '@/services/usernames'
import { mapFunctionError } from '@/lib/callable'
import { validateUsername } from '@/lib/validation'
import {
  ALLOWED_IMAGE_TYPES,
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_AVATAR_SIZE,
} from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

export interface ProfileEditModalProps {
  open: boolean
  onClose: () => void
}

/** Edit displayName, bio, avatar (with old-file cleanup) and username. */
export function ProfileEditModal({ open, onClose }: ProfileEditModalProps) {
  const { profile, user } = useAuth()
  const toast = useToast()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [username, setUsername] = useState('')
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null)
  const [previewURL, setPreviewURL] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const usernameStatus = useUsernameAvailability(username)
  const editingUsername = username.trim() !== (profile?.username ?? '')
  const avatarChanged = pendingAvatar !== null
  const dirty =
    avatarChanged ||
    editingUsername ||
    displayName.trim() !== (profile?.displayName ?? '') ||
    bio.trim() !== (profile?.bio ?? '')

  // Prime local state from the live profile each time the modal opens.
  const [primedFor, setPrimedFor] = useState<string | null>(null)
  const profileKey = profile?.uid ?? ''
  if (open && primedFor !== profileKey) {
    setPrimedFor(profileKey)
    setDisplayName(profile?.displayName ?? profile?.username ?? '')
    setBio(profile?.bio ?? '')
    setUsername(profile?.username ?? '')
    setPendingAvatar(null)
    setPreviewURL(null)
    setUploadProgress(0)
    setAvatarError(null)
    setError(null)
  }

  function pickFile() {
    fileRef.current?.click()
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setAvatarError('Use a JPEG, PNG, WEBP or GIF image.')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Avatar must be under 5 MB.')
      return
    }
    setAvatarError(null)
    setPendingAvatar(file)
    setPreviewURL(URL.createObjectURL(file))
  }

  async function onSave() {
    if (!user || !profile) return
    setError(null)

    // Validate + change username (server-validated, atomic).
    if (editingUsername) {
      const u = validateUsername(username)
      if (!u.ok) {
        setError(u.reason)
        return
      }
      if (usernameStatus === 'taken' || usernameStatus === 'checking') {
        setError(usernameStatus === 'taken' ? 'Username already taken' : 'Wait for the username check.')
        return
      }
    }

    setSaving(true)
    try {
      if (editingUsername) {
        try {
          await changeUsername(username.trim())
        } catch (err) {
          setError(mapFunctionError(err, 'Could not change username.'))
          setSaving(false)
          return
        }
      }

      // Upload the new avatar first so the profile never points at a file
      // that doesn't exist yet; delete the old one only after the swap.
      if (pendingAvatar) {
        setUploading(true)
        try {
          const { path, url } = await uploadAvatar(user.uid, pendingAvatar, setUploadProgress)
          const previous = profile.avatarPath
          await updatePublicProfile(user.uid, { avatarPath: path, avatarURL: url })
          if (previous && previous !== path) await deleteStorageObject(previous)
        } catch {
          setError('Avatar upload failed. Try again.')
          setSaving(false)
          return
        } finally {
          setUploading(false)
        }
      }

      await updatePublicProfile(user.uid, {
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      })

      toast.success('Profile updated')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSave = !saving && !uploading

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" className="max-w-md">
      <div className="space-y-5">
        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={pickFile}
            disabled={saving || uploading}
            aria-label="Change avatar"
            className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Avatar
              src={previewURL ?? profile?.avatarURL ?? null}
              name={displayName || profile?.username}
              size={88}
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={22} />
            </span>
          </button>

          {uploading ? (
            <div className="flex w-full max-w-55 items-center gap-2">
              <Loader2 size={16} className="animate-spin text-brand" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-subtle">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pickFile}
              disabled={saving}
              leftIcon={<Upload size={14} />}
            >
              Change photo
            </Button>
          )}
          {avatarError && <p className="text-xs font-medium text-danger">{avatarError}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileSelected}
            aria-hidden
            tabIndex={-1}
          />
        </div>

        {/* Username */}
        <div>
          <Input
            label="Username"
            placeholder="alex"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            leftIcon={<AtSign size={17} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={saving}
          />
          {editingUsername && usernameStatus === 'taken' && (
            <p className="mt-1.5 text-xs font-medium text-danger">Username already taken</p>
          )}
          <p className="mt-1.5 text-xs text-ink-muted">
            Friends search this name. Letters, numbers, _ and . — 3 to 20 characters.
          </p>
        </div>

        {/* Display name */}
        <Input
          label="Display name"
          placeholder="Your name"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={saving}
        />

        {/* Bio */}
        <div>
          <Textarea
            label="Bio"
            placeholder="A few words about you…"
            rows={3}
            maxLength={BIO_MAX_LENGTH}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={saving}
          />
          <p
            className={cn(
              'mt-1 text-right text-xs',
              bio.length > BIO_MAX_LENGTH ? 'text-danger' : 'text-ink-muted',
            )}
          >
            {bio.length}/{BIO_MAX_LENGTH}
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={!canSave}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onSave} loading={saving} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}
