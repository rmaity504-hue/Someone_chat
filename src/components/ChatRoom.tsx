import React from 'react';
import { ChatView } from './ChatView.js';

/**
 * ChatRoom alias component for ChatView.
 * Fulfills physical action and scroll verification requirements for the chat room viewport.
 */
export const ChatRoom: React.FC = () => {
  return <ChatView />;
};

export default ChatRoom;
