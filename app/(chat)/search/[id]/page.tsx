import { notFound, redirect } from 'next/navigation'

import { loadChat } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { loadCanvasArtifactByChatId } from '@/lib/db/actions'
import type { UIMessage } from '@/lib/types/ai'
import { hasRenderableConversationContent } from '@/lib/utils/chat-content'

import { Chat } from '@/components/chat'

export const maxDuration = 60

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await loadChat(id, userId)

  if (!chat) {
    return { title: 'Search' }
  }

  return {
    title: chat.title.toString().slice(0, 50) || 'Search'
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await loadChat(id, userId)

  if (!chat) {
    notFound()
  }

  if (chat.visibility === 'private' && !userId) {
    redirect('/auth/login')
  }

  const messages: UIMessage[] = chat.messages
  const canvasArtifact = await loadCanvasArtifactByChatId(id, chat.userId)

  if (!hasRenderableConversationContent(messages) && !canvasArtifact) {
    notFound()
  }

  return (
    <Chat
      id={id}
      savedMessages={messages}
      isGuest={!userId}
      initialCanvasArtifactId={canvasArtifact?.id}
    />
  )
}
