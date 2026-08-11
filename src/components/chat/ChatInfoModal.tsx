'use client'

import { useState } from 'react'
import { Ban, ShieldCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { useBlockedByMe } from '@/hooks/useBlockedByMe'
import { unblockUser } from '@/services/blocks'
import { mapFunctionError } from '@/lib/callable'
import { BlockConfirmDialog } from '@/components/block/BlockConfirmDialog'

export interface ChatInfoModalProps {
  open: boolean
  onClose: () => void
  peerUid: string
  peerName: string
  peerUsername: string
  peerAvatarURL: string | null
}

/**
 * Chat header info: shows the peer's identity and the block/unblock control.
 * Blocking from here also leaves the chat (the conversation is removed).
 */
export function ChatInfoModal({
  open,
  onClose,
  peerUid,
  peerName,
  peerUsername,
  peerAvatarURL,
}: ChatInfoModalProps) {
  const toast = useToast()
  const { blockedByMe, ready } = useBlockedByMe()
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [unblocking, setUnblocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAct = peerUid !== ''
  const isBlocked = ready && canAct && blockedByMe.has(peerUid)

  async function unblock() {
    if (!peerUid) return
    setUnblocking(true)
    setError(null)
    try {
      await unblockUser(peerUid)
      toast.info(`Unblocked @${peerUsername}`)
      onClose()
    } catch (err) {
      setError(mapFunctionError(err, 'Could not unblock this user'))
    } finally {
      setUnblocking(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Conversation info">
        <div className="flex flex-col items-center text-center">
          <Avatar src={peerAvatarURL} name={peerName} size={72} />
          <h3 className="mt-3 text-base font-bold text-ink">{peerName}</h3>
          <p className="text-sm text-ink-muted">@{peerUsername}</p>
        </div>

        <div className="my-6 h-px bg-border-subtle" />

        <div className="space-y-2">
          {isBlocked ? (
            <div className="flex items-start gap-2 rounded-xl bg-surface-raised p-3 text-sm text-ink-muted">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              <span>
                You&rsquo;ve blocked <span className="font-medium text-ink">@{peerUsername}</span>. They can&rsquo;t
                message you or see your Status. Unblocking lets you reconnect by sending a new request.
              </span>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">
              Blocking removes this chat and severs your connection with @{peerUsername}.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            variant={isBlocked ? 'secondary' : 'danger'}
            className="w-full"
            onClick={isBlocked ? () => void unblock() : () => setConfirmingBlock(true)}
            loading={isBlocked ? unblocking : false}
            disabled={!canAct}
            leftIcon={isBlocked ? undefined : <Ban size={15} />}
          >
            {isBlocked ? 'Unblock' : 'Block user'}
          </Button>
        </div>
      </Modal>

      <BlockConfirmDialog
        open={confirmingBlock}
        onClose={() => setConfirmingBlock(false)}
        targetUid={peerUid}
        targetName={peerUsername}
        navigateTo="/home"
      />
    </>
  )
}
