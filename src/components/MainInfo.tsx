
import React from "react";

const requirements = [
  { title: "Chat with Various LLMs", description: "Talk to multiple large language models." },
  { title: "Authentication & Sync", description: "Sign in and sync your chats across devices." },
  { title: "Attachment Support", description: "Upload files (images and PDFs)." },
  { title: "Syntax Highlighting", description: "Beautiful code formatting and highlighting." },
  { title: "Chat Sharing", description: "Share conversations with others." },
  { title: "Web Search", description: "Real-time web search integration." },
  { title: "Mobile App", description: "Fully mobile responsive experience." },
];

const MainInfo: React.FC = () => {
  return (
    <div className="bg-[#21172a]/90 rounded-2xl mt-10 px-6 py-6 shadow-lg border border-[#3B2B55] animate-fade-in w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-1 text-white tracking-tight">Core Requirements</h2>
      <div className="mb-5 text-zinc-300 text-base">The minimum to qualify for a prize</div>
      <ul className="space-y-4">
        {requirements.map((r) => (
          <li key={r.title}>
            <div className="font-semibold text-white text-lg mb-0.5 flex gap-2 items-center">• {r.title}</div>
            {r.description && <div className="text-zinc-400 text-sm ml-5">{r.description}</div>}
          </li>
        ))}
      </ul>
      <div className="mt-6 text-pink-400 font-semibold text-base">
        Did I miss something?
      </div>
    </div>
  );
};

export default MainInfo;
