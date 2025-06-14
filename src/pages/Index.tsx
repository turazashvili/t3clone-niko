
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ChatInputBar from "@/components/ChatInputBar";
import ChatArea from "./ChatArea";
import EmptyState from "./EmptyState";
import ModelSelector from "@/components/ModelSelector";
import FooterNotice from "@/components/FooterNotice";
import { useChat } from "@/hooks/useChat";

const Index = () => {
  const {
    loginOpen, setLoginOpen,
    user,
    currentChatId,
    messages,
    inputValue, setInputValue,
    isLoading,
    sidebarRefreshKey,
    selectedModel, setSelectedModel,
    webSearchEnabled, setWebSearchEnabled,
    handleSendMessage,
    handleNewChat,
    loadChat,
    handleSignOut,
  } = useChat();

  return (
    <div className="flex min-h-screen h-screen w-full bg-transparent">
      <Sidebar
        onLoginClick={() => setLoginOpen(true)}
        onNewChatClick={handleNewChat}
        onLoadChat={loadChat}
        userId={user?.id}
        onSignOutClick={handleSignOut}
        triggerRefresh={sidebarRefreshKey}
      />
      {/* Main area: flex-col, chat area scrolls, input/footer pinned */}
      <main className="flex-1 flex flex-col min-h-0 h-full relative bg-transparent">
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            {messages.length === 0 && !isLoading ? (
              <EmptyState />
            ) : (
              <ChatArea messages={messages} isLoading={isLoading} />
            )}
          </div>
        </div>
        {/* Chat Input Area - pinned at the bottom, not part of the scrollable area */}
        <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
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
      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        afterLogin={() => { /* refreshed via useChat hook */ }}
      />
    </div>
  );
};

export default Index;

