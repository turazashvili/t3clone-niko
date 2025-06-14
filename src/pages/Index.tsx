
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import QuickActions from "@/components/QuickActions";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import LoginModal from "@/components/LoginModal";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import { Send, Bot, User as UserIcon, Loader2 } from "lucide-react";

interface Message {
  id: string; // Or number, depending on your DB
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

const Index = () => {
  const [loginOpen, setLoginOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) { // If logged out, clear chat
        handleNewChat();
      }
    });

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchChatMessages = async (chatId: string) => {
    if (!chatId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: "Error fetching messages", description: error.message, variant: "destructive" });
      setMessages([]);
    } else {
      setMessages(data as Message[]);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to start chatting.", variant: "default" });
      setLoginOpen(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(), // Temporary ID
      role: "user",
      content: inputValue,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-handler', {
        body: {
          chatId: currentChatId,
          userMessageContent: userMessage.content,
          userId: user.id,
        },
      });

      if (error) throw error;

      const { assistantResponse, chatId: newChatId } = data;
      if (!currentChatId && newChatId) {
        setCurrentChatId(newChatId);
      }
      
      // Fetch all messages to ensure sync after new chat creation or if IDs are important
      // Alternatively, just add the assistant response if IDs are not critical for immediate display.
      // For robustness, let's refetch if it's a new chat, otherwise append.
      if (!currentChatId && newChatId) {
        await fetchChatMessages(newChatId);
      } else {
         const assistantMessage: Message = {
            id: Date.now().toString() + "_assistant", // Temporary ID
            role: "assistant",
            content: assistantResponse,
         };
         setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      }

    } catch (err: any) {
      toast({ title: "Error sending message", description: err.message || "Could not connect to chat service.", variant: "destructive" });
      // Optionally remove the optimistically added user message or mark as failed
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInputValue("");
  };
  
  // Function to be passed to Sidebar to load a specific chat
  // This will be enhanced later when recent chats are dynamic
  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    fetchChatMessages(chatId);
  };

  return (
    <div className="flex min-h-screen w-full bg-transparent">
      <Sidebar 
        onLoginClick={() => setLoginOpen(true)} 
        onNewChatClick={handleNewChat}
        onLoadChat={loadChat} // Pass loadChat to Sidebar
        userId={user?.id}
      />
      <main className="flex-1 flex flex-col min-h-screen relative bg-transparent">
        {messages.length === 0 && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-start pt-24">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              How can I help you?
            </h1>
            <QuickActions onQuestionClick={(q) => {
              if (!user) { setLoginOpen(true); return; }
              setInputValue(q);
              setTimeout(handleSendMessage, 0); // Send message after input is set
            }} />
            <SuggestedQuestions onQuestionClick={(q) => {
              if (!user) { setLoginOpen(true); return; }
              setInputValue(q);
              setTimeout(handleSendMessage, 0);
            }} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pt-8 pb-24 px-4 md:px-6 lg:px-8 space-y-4">
            {messages.map((msg, index) => (
              <div key={msg.id || index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl p-3 rounded-xl flex items-start gap-2 ${
                  msg.role === 'user' 
                    ? 'bg-accent text-white rounded-br-none' 
                    : 'bg-[#271d37] text-white/90 rounded-bl-none'
                }`}>
                  {msg.role === 'assistant' && <Bot size={20} className="text-white/70 mt-0.5 shrink-0" />}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'user' && <UserIcon size={20} className="text-white/70 mt-0.5 shrink-0" />}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Chat Input Area */}
        <div className="w-full max-w-3xl mx-auto px-4 pb-6 sticky bottom-0 bg-transparent pt-2">
          <div className="rounded-2xl bg-[#1a1625] border border-[#271d37] mt-4 flex items-center text-white px-4 py-2 shadow-inner">
            <input
              className="bg-transparent grow outline-none text-lg text-white placeholder:text-white/40"
              placeholder="Type your message here..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              disabled={isLoading || !user}
            />
            <button
              className="ml-3 bg-accent text-white rounded-xl p-3 hover:bg-accent-dark transition disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim() || !user}
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          {!user && (
            <p className="text-xs text-center text-amber-400 mt-2">
              Please <button onClick={() => setLoginOpen(true)} className="underline hover:text-amber-200">login</button> to chat.
            </p>
          )}
          <div className="text-xs text-white/40 mt-2 text-center">
            Make sure you agree to our <a href="#" className="underline hover:text-accent">Terms</a> and <a href="#" className="underline hover:text-accent">Privacy Policy</a>
          </div>
        </div>
      </main>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} afterLogin={() => supabase.auth.getSession().then(({data}) => { setUser(data.session?.user ?? null); setSession(data.session); })} />
    </div>
  );
};

export default Index;
