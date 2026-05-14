'use client';

import ServerSidebar from '@/components/ServerSidebar';
import ChannelSidebar from '@/components/ChannelSidebar';
import ChatView from '@/components/ChatView';

export default function AppPage() {
  return (
    <>
      <ServerSidebar />
      <ChannelSidebar />
      <ChatView />
    </>
  );
}
