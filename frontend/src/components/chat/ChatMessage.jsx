import React, { useState } from 'react';
import { Bot, User, Copy, Check, Terminal } from 'lucide-react';

/**
 * Lightweight helper to format markdown-like text elements (bold, code blocks, tables, lists)
 */
function renderFormattedMarkdown(content) {
  if (!content) return null;

  // Split into code blocks vs standard text
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const firstLineEnd = part.indexOf('\n');
      const lang = firstLineEnd !== -1 ? part.substring(3, firstLineEnd).trim() : '';
      const code = firstLineEnd !== -1 ? part.substring(firstLineEnd + 1, part.length - 3) : part.substring(3, part.length - 3);

      return (
        <CodeBlock key={index} code={code.trim()} language={lang || 'cypher'} />
      );
    }

    // Process inline markdown lines
    const lines = part.split('\n');
    return (
      <div key={index} className="space-y-1.5 my-1">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} className="h-2" />;

          // Headers
          if (line.startsWith('### ')) {
            return <h4 key={lIdx} className="font-heading font-bold text-sm text-zinc-900 mt-2 mb-1">{parseInlineStyles(line.slice(4))}</h4>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={lIdx} className="font-heading font-bold text-base text-zinc-900 mt-3 mb-1">{parseInlineStyles(line.slice(3))}</h3>;
          }
          if (line.startsWith('# ')) {
            return <h2 key={lIdx} className="font-heading font-bold text-lg text-zinc-900 mt-3 mb-1">{parseInlineStyles(line.slice(2))}</h2>;
          }

          // Bullet lists
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            return (
              <div key={lIdx} className="flex items-start gap-2 pl-2 text-xs leading-relaxed text-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-black mt-1.5 shrink-0" />
                <span>{parseInlineStyles(line.trim().slice(2))}</span>
              </div>
            );
          }

          // Blockquotes
          if (line.trim().startsWith('> ')) {
            return (
              <blockquote key={lIdx} className="border-l-2 border-zinc-400 pl-3 py-0.5 text-xs text-zinc-600 italic bg-zinc-50 rounded-r-md">
                {parseInlineStyles(line.trim().slice(2))}
              </blockquote>
            );
          }

          return (
            <p key={lIdx} className="text-xs text-zinc-800 leading-relaxed font-body">
              {parseInlineStyles(line)}
            </p>
          );
        })}
      </div>
    );
  });
}

function parseInlineStyles(text) {
  // Bold & inline code parsing
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i} className="font-bold text-black">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={i} className="font-mono bg-zinc-200 text-zinc-900 px-1 py-0.5 rounded text-[11px] border border-zinc-300">{token.slice(1, -1)}</code>;
    }
    return token;
  });
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden shadow-sm font-mono text-[11px]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1.5 uppercase font-bold text-zinc-300">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto leading-relaxed text-zinc-200 no-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ChatMessage({ message }) {
  const isUser = message.sender === 'user';
  const [copiedText, setCopiedText] = useState(false);

  const handleCopyFull = () => {
    navigator.clipboard.writeText(message.text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className={`flex gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl transition-all ${
      isUser ? 'bg-zinc-100/80 border border-zinc-200/80 self-end max-w-[85%]' : 'bg-white border border-zinc-200 self-start w-full shadow-xs'
    }`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
        isUser ? 'bg-black text-white' : 'bg-zinc-900 text-white border border-zinc-700'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-heading font-bold text-xs text-zinc-900">
            {isUser ? 'You' : 'Graphora AI Assistant'}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-400">
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            {!isUser && message.text && (
              <button
                onClick={handleCopyFull}
                className="p-1 text-zinc-400 hover:text-black rounded transition-colors"
                title="Copy response"
              >
                {copiedText ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Text body */}
        <div className="font-body text-xs text-zinc-800 leading-relaxed">
          {renderFormattedMarkdown(message.text)}

          {/* Typing pulse indicator if streaming */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-black animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
