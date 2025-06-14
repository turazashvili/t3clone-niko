import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ChatInputBar from "@/components/ChatInputBar";
import ChatArea from "./ChatArea";
import EmptyState from "./EmptyState";
import ModelSelector from "@/components/ModelSelector";
import FooterNotice from "@/components/FooterNotice";
import { useChat } from "@/hooks/useChat";

// Keep this in sync with Sidebar width!
const SIDEBAR_WIDTH = 290; // px

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
      />
      {/* Main content with left margin = sidebar width */}
      <main
        className="flex flex-col min-h-screen"
        style={{ marginLeft: SIDEBAR_WIDTH }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {messages.length === 0 && !isLoading ? (
            <EmptyState />
          ) : (
            <ChatArea messages={messages} isLoading={isLoading} />
          )}
        </div>
        {/* Chat Input Area */}
        <div className="w-full mx-auto px-4 pb-6 sticky bottom-0 bg-transparent pt-2">
          <div className="flex items-center justify-between mb-2">
            <ModelSelector selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
          </div>
          <ChatInputBar
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSend={handleSendMessage}
            isLoading={isLoading}
            disabled={!user}
            user={user}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            webSearchEnabled={webSearchEnabled}
            setWebSearchEnabled={setWebSearchEnabled}
          />
          <FooterNotice />
        </div>
      </main>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} afterLogin={() => { /* refreshed via useChat hook */ }} />
    </div>
  );
};

export default Index;
