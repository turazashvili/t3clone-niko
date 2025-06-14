
// Only import useEffect once (with React)
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import ChatInputBar from "@/components/ChatInputBar";
import ChatArea from "./ChatArea";
import EmptyState from "./EmptyState";
import ModelSelector from "@/components/ModelSelector";
import FooterNotice from "@/components/FooterNotice";
import { useChat } from "@/hooks/useChat";
import { UploadedFile } from "@/hooks/useFileUpload";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
// Removed duplicate: import { useEffect } from "react";
import { useLocation } from "react-router-dom";

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
    setSidebarRefreshKey,
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

  // Add UI state for public/private status if chat selected
  const [isPublic, setIsPublic] = useState<boolean | null>(null);

  // Fetch current chat public flag
  useEffect(() => {
    const fetchIsPublic = async () => {
      if (!currentChatId) {
        setIsPublic(null);
        return;
      }
      const { data } = await supabase
        .from("chats")
        .select("is_public")
        .eq("id", currentChatId)
        .maybeSingle();
      setIsPublic(data?.is_public ?? false);
    };
    fetchIsPublic();
  }, [currentChatId, sidebarRefreshKey]);

  // Handler to toggle public/private
  const handleTogglePublic = async () => {
    if (!currentChatId) return;
    const { data, error } = await supabase
      .from("chats")
      .update({ is_public: !isPublic })
      .eq("id", currentChatId)
      .select()
      .maybeSingle();
    if (error) {
      toast({ title: "Failed to update chat privacy", description: error.message, variant: "destructive" });
      return;
    }
    setIsPublic(data?.is_public ?? false);
    setSidebarRefreshKey(Date.now());
    toast({ title: `Chat ${data.is_public ? "is now public" : "is now private"}` });
  };

  // Handler to copy share link
  const handleCopyLink = () => {
    if (!currentChatId) return;
    const link = `${window.location.origin}/chat/${currentChatId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Chat link copied!", description: link });
  };

  // Enhanced handleSend to support attachments
  const handleSend = (model: string, webSearchEnabled: boolean) => {
    // pass attachedFiles to useChat, then clear
    handleSendMessage(model, webSearchEnabled, attachedFiles);
    setAttachedFiles([]);
  };

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
            <>
              <div className="flex items-center justify-end px-4 max-w-3xl mx-auto pt-4 space-x-3">
                {currentChatId && isPublic !== null && (
                  <>
                    <button
                      className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-medium ${
                        isPublic
                          ? "bg-green-100 border-green-400 text-green-700"
                          : "bg-gray-100 border-gray-300 text-gray-600"
                      }`}
                      onClick={handleTogglePublic}
                    >
                      {isPublic ? "Public" : "Private"}
                    </button>
                    <button
                      className="flex items-center gap-1 px-3 py-1 rounded border border-gray-300 bg-white text-xs font-medium hover:bg-gray-50"
                      onClick={handleCopyLink}
                    >
                      <Copy size={14} /> Share
                    </button>
                  </>
                )}
              </div>
              <ChatArea messages={messages} isLoading={isLoading} />
            </>
          )}
        </div>
        {/* Chat Input Area */}
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
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} afterLogin={() => { /* refreshed via useChat hook */ }} />
    </div>
  );
};

export default Index;
