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

  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isPublic, setIsPublic] = useState<boolean | undefined>(undefined);

  // Set current chat by chatId from URL
  useEffect(() => {
    if (chatId && chatId !== currentChatId) {
      setCurrentChatId(chatId);
      loadChat(chatId);
    }
    // eslint-disable-next-line
  }, [chatId]);

  // Fetch is_public for the chat
  useEffect(() => {
    let ignore = false; // Prevent state update after unmount
    const fetchIsPublic = async () => {
      if (!chatId) {
        setIsPublic(undefined);
        return;
      }
      // Import supabase client
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("chats")
        .select("is_public")
        .eq("id", chatId)
        .maybeSingle();
      if (!ignore) {
        if (error || !data) {
          setIsPublic(undefined);
        } else {
          setIsPublic(data.is_public ?? false);
        }
      }
    };
    fetchIsPublic();
    return () => {
      ignore = true;
    };
  }, [chatId]);

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
      {/* Floating share button corner container */}
      <div
        className="fixed z-30 top-2 right-4 md:right-12 flex items-center gap-2"
        style={{
          // Height/width set for nice floating button area (matches screenshot)
          // Adjust right/spacing for where your controls are!
          pointerEvents: "none", // so only button is interactive, not whole div
        }}
      >
        <ShareChatButton chatId={chatId} isPublic={isPublic} />
      </div>
      <main
        className="flex flex-col min-h-screen"
        style={{ marginLeft: SIDEBAR_WIDTH }}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Remove old share button position */}
          <div className="flex items-center justify-between pt-4 pb-2 max-w-3xl mx-auto px-4">
            <div />
            {/* ShareChatButton removed from here */}
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
