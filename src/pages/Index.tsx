
import Sidebar from "@/components/Sidebar";
import QuickActions from "@/components/QuickActions";
import SuggestedQuestions from "@/components/SuggestedQuestions";

const Index = () => {
  return (
    <div className="flex min-h-screen w-full bg-transparent">
      {/* Left Sidebar */}
      <Sidebar />
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col items-center min-h-screen justify-between relative bg-transparent">
        <div className="flex-1 flex flex-col items-center justify-start pt-24">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            How can I help you?
          </h1>
          <QuickActions />
          <SuggestedQuestions />
        </div>
        {/* Chat Input (footer placeholder) */}
        <div className="w-full max-w-2xl mx-auto px-4 pb-6">
          <div className="rounded-2xl bg-[#1a1625] border border-[#271d37] mt-4 flex items-center text-white px-4 py-3 shadow-inner">
            <input
              className="bg-transparent grow outline-none text-lg text-white placeholder:text-white/40"
              placeholder="Type your message here..."
              disabled
            />
            <button
              className="ml-2 bg-accent text-white rounded-xl p-2 hover:bg-accent-dark transition disabled:opacity-70"
              disabled
            >
              <svg width="20" height="20" className="text-white" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M19 12l-7 7m7-7l-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="text-xs text-white/40 mt-2 text-center">
            Make sure you agree to our <a href="#" className="underline hover:text-accent">Terms</a> and <a href="#" className="underline hover:text-accent">Privacy Policy</a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
