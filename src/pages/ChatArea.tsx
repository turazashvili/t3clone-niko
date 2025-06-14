
import React from "react";
import ChatMessage from "@/components/ChatMessage";
import { useChat } from "@/hooks/useChat";

const ChatArea = ({ messages, isLoading }: { messages: any[], isLoading: boolean }) => {
  const {
    setMessages,
    selectedModel,
    currentChatId,
    deleteMessagesAfter,
    editMessage,
  } = useChat();

  // Debug: Log messages every render
  console.log("[ChatArea render] messages:", messages);

  return (
    <div className="flex flex-col gap-2 px-2 py-6">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          msg={msg}
          messages={messages}
          setMessages={setMessages}
          selectedModel={selectedModel}
          currentChatId={currentChatId}
          deleteMessagesAfter={deleteMessagesAfter}
          editMessage={editMessage}
        />
      ))}
      {isLoading && (
        <div className="text-center text-gray-400 mt-10">AI is thinking...</div>
      )}
    </div>
  );
};

export default ChatArea;
