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

const SIDEBAR_COLLAPSED_KEY = "t3chat_sidebar_collapsed";

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

  // Add input+focus handler for prompt clicks (same as Index)
  const inputRef = React.useRef<any>(null);
  const handleSetInputValueAndFocus = (value: string) => {
    setInputValue(value);
    setTimeout(() => {
      inputRef.current?.focus?.();
    }, 1);
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
      <Sidebar
        onLoginClick={() => setLoginOpen(true)}
        onNewChatClick={handleNewChat}
        onLoadChat={(id) => {
          navigate(`/chat/${id}`);
        }}
        userId={user?.id}
        onSignOutClick={handleSignOut}
        triggerRefresh={sidebarRefreshKey}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
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
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between pt-4 pb-2 max-w-3xl mx-auto px-4">
            <div />
            {/* Only show if this is a valid chatId */}
            <ShareChatButton chatId={chatId} />
          </div>
          <div className={`w-full ${
              collapsed
                ? "flex justify-center"
                : ""
            }`}
          >
            <div className={`flex-1 ${collapsed ? "max-w-3xl" : ""}`}>
              {messages.length === 0 && !isLoading && !inputValue.trim() ? (
                <EmptyState onPromptClick={handleSetInputValueAndFocus} />
              ) : (
                <ChatArea messages={messages} isLoading={isLoading} />
              )}
            </div>
          </div>
        </div>
        <div className="w-full sticky bottom-0 bg-transparent pt-2 pb-6">
          <div className={`mx-auto px-4 ${collapsed ? "max-w-3xl" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <ModelSelector selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
            </div>
            {/* Connect inputRef here if you want focus to work, optional */}
            <ChatInputBar
              ref={inputRef}
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
