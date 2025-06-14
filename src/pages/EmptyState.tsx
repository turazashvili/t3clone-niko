
import React from "react";
import QuickActions from "@/components/QuickActions";
import SuggestedQuestions from "@/components/SuggestedQuestions";

const EmptyState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-start pt-24">
    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
      How can I help you?
    </h1>
    <QuickActions />
    <SuggestedQuestions />
  </div>
);

export default EmptyState;
