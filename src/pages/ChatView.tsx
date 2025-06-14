import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ChatInputBar from "@/components/ChatInputBar";
import ChatArea from "./ChatArea";
import EmptyState from "./EmptyState";
import ModelSelector from "@/components/ModelSelector";
import FooterNotice from "@/components/FooterNotice";
import { useChat } from "@/hooks/useChat";
import { UploadedFile } from "@/hooks/useFileUpload";
import ShareChatButton from "@/components/ShareChatButton";

// Keep this in sync with Sidebar width!
const SIDEBAR_WIDTH = 290; // px

const ChatView = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const {
    loginOpen,
    setLoginOpen,
    user,
    setCurrentChatId,
    currentChatId,
    messages,
    inputValue,
    setInputValue,
    isLoading,
    sidebarRefreshKey,
    selectedModel,
    setSelectedModel,
    webSearchEnabled,
    setWebSearchEnabled,
    handleSendMessage,
    handleNewChat,
    loadChat,
    handleSignOut,
  } = useChat();

  // Set current chat by chatId from URL
  useEffect(() => {
    if (chatId && chatId !== currentChatId) {
      setCurrentChatId(chatId);
      loadChat(chatId);
    }
    // eslint-disable-next-line
  }, [chatId]);

  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);

  const handleSend = (model: string, webSearchEnabled: boolean) => {
    handleSendMessage(model, webSearchEnabled, attachedFiles);
    setAttachedFiles([]);
  };

  return (
    <div className="relative min-h-screen w-full bg-transparent">
      <Sidebar
        onLoginClick={() => setLoginOpen(true)}
        onNewChatClick={handleNewChat}
        onLoadChat={(id) => {
          navigate(`/chat/${id}`);
        }}
        userId={user?.id}
        onSignOutClick={handleSignOut}
        triggerRefresh={sidebarRefreshKey}
      />
      <main
        className="flex flex-col min-h-screen"
        style={{ marginLeft: SIDEBAR_WIDTH }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between pt-4 pb-2 max-w-3xl mx-auto px-4">
            <div />
            {/* Only show if this is a valid chatId */}
            <ShareChatButton chatId={chatId} />
          </div>
          {messages.length === 0 && !isLoading ? (
            <EmptyState />
          ) : (
            <ChatArea messages={messages} isLoading={isLoading} />
          )}
        </div>
        <div className="w-full sticky bottom-0 bg-transparent pt-2 pb-6">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center justify-between mb-2">
              <ModelSelector selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
            </div>
            <ChatInputBar
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSend={handleSend}
              isLoading={isLoading}
              disabled={!user}
              user={user}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              webSearchEnabled={webSearchEnabled}
              setWebSearchEnabled={setWebSearchEnabled}
              attachedFiles={attachedFiles}
              setAttachedFiles={setAttachedFiles}
            />
            <FooterNotice />
          </div>
        </div>
      </main>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} afterLogin={() => {}} />
    </div>
  );
};

export default ChatView;
