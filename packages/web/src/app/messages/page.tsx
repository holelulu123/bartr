'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMessageSidebar } from '@/contexts/message-sidebar-context';

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSidebar, openThread, openContact } = useMessageSidebar();

  useEffect(() => {
    const threadId = searchParams.get('thread');
    const contact = searchParams.get('contact');

    if (threadId) {
      openThread(threadId);
    } else if (contact) {
      openContact(contact);
    } else {
      openSidebar();
    }

    router.replace('/');
  }, [searchParams, openSidebar, openThread, openContact, router]);

  return null;
}
