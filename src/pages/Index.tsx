import React, { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ChatInputBar, { ChatInputBarRef } from "@/components/ChatInputBar";
import ChatArea from "./ChatArea";
import EmptyState from "./EmptyState";
import ModelSelector from "@/components/ModelSelector";
import FooterNotice from "@/components/FooterNotice";
import { useChat } from "@/hooks/useChat";
import { UploadedFile } from "@/hooks/useFileUpload";

// Keep this in sync with Sidebar width!
const SIDEBAR_WIDTH = 290; // px

const SIDEBAR_COLLAPSED_KEY = "t3chat_sidebar_collapsed";

const Index = () => {
  const {
    loginOpen,
    setLoginOpen,
    user,
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

  // NEW STATE FOR ATTACHMENTS
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);

  // Setup ChatInputBar ref
  const chatInputBarRef = useRef<ChatInputBarRef>(null);

  // Handler to set input and focus the input bar
  const handleSetInputValueAndFocus = (value: string) => {
    setInputValue(value);
    // Delay focus slightly to allow state to settle
    setTimeout(() => {
      chatInputBarRef.current?.focus();
    }, 1);
  };

  // Enhanced handleSend to support attachments
  const handleSend = (model: string, webSearchEnabled: boolean) => {
    // pass attachedFiles to useChat, then clear
    handleSendMessage(model, webSearchEnabled, attachedFiles);
    setAttachedFiles([]);
  };

  // --- Collapsed sidebar state ---
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return stored === "true";
    }
    return false;
  });

  return (
    <div className="relative min-h-screen w-full bg-transparent">
      {/* Fix Sidebar */}
      <Sidebar
        onLoginClick={() => setLoginOpen(true)}
        onNewChatClick={handleNewChat}
        onLoadChat={loadChat}
        userId={user?.id}
        onSignOutClick={handleSignOut}
        triggerRefresh={sidebarRefreshKey}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      {/* Main content */}
      <main
        className={`flex flex-col min-h-screen transition-all duration-200 ${
          collapsed
            ? "ml-0"
            : ""
        }`}
        style={
          collapsed
            ? { marginLeft: 0 }
            : { marginLeft: SIDEBAR_WIDTH }
        }
      >
        <div className={`flex-1 flex flex-col min-h-0 ${
          collapsed ? "items-center" : ""
        }`}>
          <div className={`w-full ${
              collapsed
                ? "flex justify-center"
                : ""
            }`}
          >
            <div className={`flex-1 ${collapsed ? "max-w-3xl" : ""}`}>
              {messages.length === 0 && !isLoading && !inputValue.trim() ? (
                <EmptyState
                  onPromptClick={handleSetInputValueAndFocus}
                />
              ) : (
                <ChatArea messages={messages} isLoading={isLoading} />
              )}
            </div>
          </div>
        </div>
        {/* Chat Input Area */}
        <div className="w-full sticky bottom-0 bg-transparent pt-2 pb-6">
          <div className={`mx-auto px-4 ${collapsed ? "max-w-3xl" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <ModelSelector selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
            </div>
            <ChatInputBar
              ref={chatInputBarRef}
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
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} afterLogin={() => { /* refreshed via useChat hook */ }} />
    </div>
  );
};

export default Index;
