import { ChatScreen } from '@/components/chat/ChatScreen'

interface ChatPageProps {
  params: Promise<{ conversationId: string }>
}

/**
 * Dynamic chat route. The page awaits the params promise (Next.js 15+)
 * and delegates to the client chat screen.
 */
export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params
  return <ChatScreen conversationId={conversationId} />
}
