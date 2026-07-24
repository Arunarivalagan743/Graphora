import React from 'react';
import { HelpCircle } from 'lucide-react';

export default function SuggestedQuestions({ questions, onSelectQuestion, disabled }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 my-3">
      <div className="flex items-center gap-1.5 text-[11px] font-heading font-semibold text-zinc-500 uppercase tracking-wider">
        <HelpCircle className="w-3.5 h-3.5 text-black" />
        <span>Suggested Graph Exploration Prompts:</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSelectQuestion(question)}
            disabled={disabled}
            className="text-left text-xs font-body bg-zinc-100 hover:bg-black hover:text-white border border-zinc-300 text-zinc-800 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
          >
            "{question}"
          </button>
        ))}
      </div>
    </div>
  );
}
