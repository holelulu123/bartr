'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMessageSidebar } from '@/contexts/message-sidebar-context';

export default function ChatRedirectPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const router = useRouter();
  const { openThread } = useMessageSidebar();

  useEffect(() => {
    openThread(threadId);
    router.replace('/');
  }, [threadId, openThread, router]);

  return null;
}
