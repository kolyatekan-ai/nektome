'use client';

import ServerSidebar from '@/components/ServerSidebar';
import ChannelSidebar from '@/components/ChannelSidebar';
import ChatView from '@/components/ChatView';
import VoicePanel from '@/components/VoicePanel';
import CallToasts from '@/components/CallToasts';

export default function AppPage() {
  return (
    <>
      <ServerSidebar />
      <ChannelSidebar />
      <ChatView />
      <VoicePanel />
      <CallToasts />
    </>
  );
}
