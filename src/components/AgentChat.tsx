import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowUp, Bot, Loader2, BarChart3, Search, Globe, Code2,
  Star, BookOpen, Zap, Sparkles, MessageSquare, ChevronDown,
} from "lucide-react";
import type { Client, Prompt, AuditResult, CompetitorGapItem, ModelStats, AuditDeltas } from "@/hooks/useClientDashboard";
import { AI_MODELS } from "@/hooks/useClientDashboard";

interface AgentChatProps {
  selectedClient: Client | null;
  prompts: Prompt[];
  auditResults: AuditResult[];
  sovScore: number;
  citationCount: number;
  ga4Connected: boolean;
  competitorGap: CompetitorGapItem[];
  modelStats: Record<string, ModelStats>;
  auditDeltas?: AuditDeltas;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS = [
  { icon: Sparkles, label: "Optimize my top prompts", prompt: "Which of my current prompts have the lowest visibility and what should I do to improve them?" },
  { icon: BarChart3, label: "Quick visibility check", prompt: "Give me a quick summary of my current AEO visibility performance and the top 3 things I should focus on." },
  { icon: MessageSquare, label: "What prompts should I add?", prompt: "Based on my brand and current prompts, what new prompts should I be tracking to improve my AI search coverage?" },
  { icon: Zap, label: "Generate an llms.txt outline", prompt: "Help me create an llms.txt file outline for my brand that will help AI models understand and cite my content better." },
];

const CONNECTORS = [
  { id: "ga4", icon: BarChart3, name: "Google Analytics", color: "text-orange-500", bg: "bg-orange-50" },
  { id: "searchConsole", icon: Search, name: "Search Console", color: "text-blue-500", bg: "bg-blue-50", comingSoon: true },
  { id: "bing", icon: Globe, name: "Bing Webmaster", color: "text-blue-400", bg: "bg-blue-50", comingSoon: true },
  { id: "github", icon: Code2, name: "GitHub", color: "text-gray-700", bg: "bg-gray-50", comingSoon: true },
  { id: "g2", icon: Star, name: "G2 Reviews", color: "text-orange-400", bg: "bg-orange-50", comingSoon: true },
  { id: "notion", icon: BookOpen, name: "Notion", color: "text-gray-700", bg: "bg-gray-50", comingSoon: true },
];

export function AgentChat({ selectedClient, prompts, auditResults, sovScore, citationCount, ga4Connected, competitorGap, modelStats, auditDeltas }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const connectorPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Close connectors panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (connectorPanelRef.current && !connectorPanelRef.current.contains(e.target as Node)) {
        setShowConnectors(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildContext = () => {
    const sorted = [...auditResults].sort(
      (a, b) => (b.summary?.share_of_voice ?? 0) - (a.summary?.share_of_voice ?? 0)
    );

    const topPrompts = sorted
      .filter(r => (r.summary?.share_of_voice ?? 0) > 0)
      .slice(0, 5)
      .map(r => ({ text: r.prompt_text, visibilityScore: Math.round(r.summary?.share_of_voice ?? 0) }));

    // Prompts with 0% or low visibility — what needs fixing
    const weakPrompts = sorted
      .filter(r => (r.summary?.share_of_voice ?? 0) < 20)
      .slice(-10)
      .map(r => ({ text: r.prompt_text, visibilityScore: Math.round(r.summary?.share_of_voice ?? 0) }));

    // Competitor SOV breakdown with percentages
    const competitorSOV = competitorGap.map(c => ({
      name: c.name,
      mentions: c.mentions,
      percentage: c.percentage,
      isBrand: c.name === selectedClient?.brand_name,
    }));

    // Per AI engine visibility rates
    const modelVisibility = AI_MODELS
      .map(m => {
        const s = modelStats[m.id];
        if (!s || s.total === 0) return null;
        return {
          name: m.name,
          visible: s.visible,
          total: s.total,
          pct: Math.round((s.visible / s.total) * 100),
        };
      })
      .filter(Boolean);

    return {
      brandName: selectedClient?.brand_name,
      brandDomain: selectedClient?.brand_domain,
      prompts: prompts.slice(0, 20).map(p => p.prompt_text),
      topPrompts,
      weakPrompts,
      competitorSOV,
      modelVisibility,
      sovScore,
      citationCount,
      competitors: selectedClient?.competitors?.slice(0, 6) || [],
      connectors: { ga4: ga4Connected, searchConsole: false },
      deltas: auditDeltas?.hasDelta ? {
        sovDelta: auditDeltas.sovDelta,
        rankDelta: auditDeltas.rankDelta,
        citationsDelta: auditDeltas.citationsDelta,
        citationRateDelta: auditDeltas.citationRateDelta,
      } : null,
    };
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          clientContext: buildContext(),
          clientId: selectedClient?.id ?? "",
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.response) throw new Error("Empty response");

      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err: any) {
      toast.error("Agent error: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const brandName = selectedClient?.brand_name || "your brand";

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-120px)]">
      {/* Main chat area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4">
            <div className="flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-5 shadow-lg shadow-blue-200">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center">
              What should I focus on, <span className="text-blue-600">{brandName}</span>?
            </h1>
            <p className="text-gray-500 text-sm mt-2 text-center max-w-md">
              Ask anything about your AEO performance. I have full context on your prompts, visibility, and citations.
            </p>

            {/* Quick action chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-xl">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
                >
                  <div className="flex-shrink-0 p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <action.icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5 items-center h-5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 bg-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Connectors panel */}
          {showConnectors && (
            <div ref={connectorPanelRef} className="mb-3 p-4 bg-white border border-gray-200 rounded-2xl shadow-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data Connectors</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONNECTORS.map(c => {
                  const isConnected = c.id === "ga4" && ga4Connected;
                  const isComingSoon = (c as any).comingSoon;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-gray-50">
                      <div className={cn("p-1.5 rounded-lg", c.bg)}>
                        <c.icon className={cn("h-4 w-4", c.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{c.name}</p>
                        {isConnected ? (
                          <span className="text-[10px] text-emerald-600 font-semibold">Connected</span>
                        ) : isComingSoon ? (
                          <span className="text-[10px] text-gray-400">Coming soon</span>
                        ) : (
                          <span className="text-[10px] text-blue-600 font-medium cursor-pointer hover:underline">Connect</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input box */}
          <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:bg-white transition-all">
            <button
              onClick={() => setShowConnectors(v => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 mb-0.5",
                showConnectors
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
              )}
            >
              Connectors
              <ChevronDown className={cn("h-3 w-3 transition-transform", showConnectors && "rotate-180")} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your AEO strategy..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 min-h-[24px] max-h-[160px]"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className={cn(
                "flex-shrink-0 p-2 rounded-xl transition-all mb-0.5",
                input.trim() && !loading
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
