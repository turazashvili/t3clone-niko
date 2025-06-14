
import { PlusCircle, Newspaper, Code2, BookOpen } from "lucide-react";

const actions = [
  {
    label: "Create",
    icon: PlusCircle,
  },
  {
    label: "Explore",
    icon: Newspaper,
  },
  {
    label: "Code",
    icon: Code2,
  },
  {
    label: "Learn",
    icon: BookOpen,
  },
];

const QuickActions = () => (
  <div className="flex flex-wrap gap-3 justify-center mb-7">
    {actions.map((action) => (
      <button
        key={action.label}
        className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#22182c]/70 text-white/90 hover:bg-accent hover:text-white font-semibold shadow transition"
        disabled
      >
        <action.icon size={18} />
        <span>{action.label}</span>
      </button>
    ))}
  </div>
);

export default QuickActions;
