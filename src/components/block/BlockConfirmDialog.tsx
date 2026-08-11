'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { blockUser } from '@/services/blocks'
import { mapFunctionError } from '@/lib/callable'

export interface BlockConfirmDialogProps {
  open: boolean
  onClose: () => void
  targetUid: string
  targetName: string
  /** Optional route to navigate to after blocking (e.g. leave the chat). */
  navigateTo?: string
}

/**
 * Confirmation dialog for blocking a user. Explains that blocking severs the
 * connection and removes the existing chat, then runs the block callable.
 */
export function BlockConfirmDialog({
  open,
  onClose,
  targetUid,
  targetName,
  navigateTo,
}: BlockConfirmDialogProps) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!targetUid) return
    setBusy(true)
    setError(null)
    try {
      await blockUser(targetUid)
      toast.success(`Blocked ${targetName}`)
      onClose()
      if (navigateTo) router.replace(navigateTo)
    } catch (err) {
      setError(mapFunctionError(err, 'Could not block this user'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Block user">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink">
          Block <span className="font-semibold">@{targetName}</span>? They won&rsquo;t be able to message
          you, send you requests, or see your Status. Any existing chat with them will be removed.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirm()} loading={busy} leftIcon={<Ban size={14} />}>
            Block
          </Button>
        </div>
      </div>
    </Modal>
  )
}
