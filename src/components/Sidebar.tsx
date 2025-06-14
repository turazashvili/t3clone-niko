
import { LogIn, Plus, Search } from "lucide-react";

const recentChats = [
  { id: 1, title: "How does AI work?" },
  { id: 2, title: "Are black holes real?" },
  { id: 3, title: "How many Rs are in 'strawberry'?" },
  { id: 4, title: "What is the meaning of life?" },
];

const Sidebar = () => (
  <aside className="flex flex-col h-screen w-[290px] bg-gradient-to-b from-[#201022] via-[#19101c] to-[#19101c] border-r border-[#251c2f]/70 px-4 py-5">
    {/* Brand */}
    <div className="flex items-center gap-2 mb-6 select-none">
      <span className="font-bold tracking-wide text-xl text-white">
        T3
        <span className="text-accent font-bold">.chat</span>
      </span>
    </div>
    {/* New Chat Button */}
    <button className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-accent font-semibold text-white shadow-sm hover:bg-accent-dark transition mb-2 text-base focus:outline-none">
      <Plus size={20} />
      New Chat
    </button>
    {/* Search */}
    <div className="relative mb-3">
      <input
        className="w-full rounded-lg bg-[#23142e] text-base text-white/90 placeholder:text-white/30 px-9 py-2 focus:outline-none"
        placeholder="Search your threads..."
        type="text"
        disabled
      />
      <Search
        size={18}
        className="absolute left-2.5 top-2.5 text-white/40 pointer-events-none"
      />
    </div>
    {/* Recent Chats List */}
    <div className="flex-1 overflow-y-auto mt-2 pr-1 custom-scrollbar">
      {recentChats.map((chat) => (
        <div
          key={chat.id}
          className="py-2 px-3 rounded-md text-white/80 hover:bg-[#251933] hover:text-white font-medium cursor-pointer transition mb-1"
        >
          {chat.title}
        </div>
      ))}
    </div>
    {/* Bottom Login Button */}
    <div className="mt-6 mb-1">
      <button className="flex items-center gap-2 text-white/80 hover:text-accent transition font-semibold px-1 py-2">
        <LogIn size={20} /> 
        Login
      </button>
    </div>
  </aside>
);

export default Sidebar;
