import React from "react";

const requirements = [
  { title: "Chat with LLMs", description: "Seamlessly converse with multiple state-of-the-art language models." },
  { title: "Auth & Sync", description: "Sign in and instantly sync your chats across all your devices." },
  { title: "Attachments", description: "Effortlessly upload and share images or PDFs in your conversations." },
  { title: "Syntax Highlighting", description: "Enjoy beautiful, readable code with smart syntax highlighting." },
  { title: "Chat Sharing", description: "Share your favorite conversations with a single click." },
  { title: "Web Search", description: "Supercharge chats with real-time web search integration." },
  { title: "Mobile App", description: "Experience a fully responsive design—perfect on any device." },
];

const MainInfo: React.FC = () => {
  return (
    <div className="bg-[#21172a]/90 rounded-2xl mt-10 px-6 py-6 shadow-lg border border-[#3B2B55] animate-fade-in w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-2 text-white tracking-tight flex items-center gap-3">
        Why T3.chat Stands Out
        <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full ml-2 animate-pulse">
          ⚡ Fully Serverless
        </span>
      </h2>
      <div className="text-zinc-300 text-sm mb-4 ml-1">Built for speed, scale, and hackathon innovation.</div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {requirements.map((r) => (
          <li key={r.title} className="flex flex-col">
            <span className="font-semibold text-white text-base flex gap-2 items-center">• {r.title}</span>
            {r.description && <span className="text-zinc-400 text-xs ml-5">{r.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MainInfo;
