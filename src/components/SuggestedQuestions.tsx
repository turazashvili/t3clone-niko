
const questions = [
  "How does AI work?",
  "Are black holes real?",
  "How many Rs are in the word \"strawberry\"?",
  "What is the meaning of life?",
];

const SuggestedQuestions = () => (
  <div className="w-full max-w-2xl mx-auto">
    {questions.map((q, i) => (
      <div
        key={i}
        className="py-3 px-2 border-b border-[#32233e] text-white/90 hover:bg-[#251933] cursor-pointer transition text-lg font-normal"
        tabIndex={0}
        role="button"
      >
        {q}
      </div>
    ))}
  </div>
);

export default SuggestedQuestions;
