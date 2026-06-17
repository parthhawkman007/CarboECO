"use client";
import { getApiUrl, getWsUrl, getAuthHeaders } from "@/utils/api";


import { useState, useEffect, useRef } from "react";
import { 
  Brain, Award, Map, Send, Sparkles, AlertTriangle, 
  HelpCircle, RefreshCw, Layers, CheckCircle2, User, Cpu 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  sender: "user" | "coach";
  text: string;
}

interface Challenge {
  title: string;
  description: string;
  xp: number;
  co2_saving: number;
}

interface RoadmapStep {
  phase: string;
  actions: string[];
  projected_co2_savings_kg: number;
  difficulty: string;
}

interface Roadmap {
  total_projected_savings_annual_kg: number;
  steps: RoadmapStep[];
}

const FALLBACK_CHALLENGES: Challenge[] = [
  { title: "Transit Trial", description: "Take the metro or bus for 3 commutes instead of driving.", xp: 80, co2_saving: 12.5 },
  { title: "Vampire Slayer", description: "Unplug all electronics and chargers not in use before bed.", xp: 50, co2_saving: 4.5 },
  { title: "Meatless Mondays", description: "Prepare fully vegetarian meals for the entire day.", xp: 60, co2_saving: 6.4 }
];

const FALLBACK_ROADMAP: Roadmap = {
  total_projected_savings_annual_kg: 1465,
  steps: [
    { phase: "Phase 1: Immediate Wins (Week 1-2)", actions: ["Swap short car trips for walking/cycling.", "Eat vegan meals 2 days per week.", "Unplug standby electronics."], projected_co2_savings_kg: 25.0, difficulty: "Easy" },
    { phase: "Phase 2: Household Adjustments (Month 1)", actions: ["Install LED lightbulbs.", "Select cold-wash wash cycles.", "Start composting organic scraps."], projected_co2_savings_kg: 60.0, difficulty: "Medium" },
    { phase: "Phase 3: Systematic Upgrades (Month 3-6)", actions: ["Upgrade to a smart thermostat.", "Purchase certified carbon offsets.", "Transition to a green electricity tariff."], projected_co2_savings_kg: 180.0, difficulty: "Medium" },
    { phase: "Phase 4: Structural Changes (Year 1+)", actions: ["Switch to a battery Electric Vehicle.", "Install rooftop solar panels.", "Install an electric heat pump."], projected_co2_savings_kg: 1200.0, difficulty: "Hard" }
  ]
};

// Preset prompts for Quick Actions
const PROMPT_PILLS = [
  "How do I optimize transport?",
  "Impact of beef vs tofu?",
  "Composting guide?",
  "Tell me about EVs vs Hybrids"
];

export default function Coach() {
  // Screen State Controls for Apple-level Polish
  const [screenState, setScreenState] = useState<"success" | "loading" | "empty" | "error">("success");
  
  const [messages, setMessages] = useState<Message[]>([
    { id: "msg-1", sender: "coach", text: "Hello! I am your AI Sustainability Coach. Ask me how to reduce your energy footprint, swap transportation modes, or calculate food impacts!" }
  ]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>(FALLBACK_CHALLENGES);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/ai/coach/challenges`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data: Challenge[] = await res.json();
          setChallenges(data);
        }
      } catch {
        setChallenges(FALLBACK_CHALLENGES);
      }
    };
    fetchChallenges();
  }, []);

  const simulateStreamingReply = (fullText: string) => {
    const messageId = Math.random().toString(36).substring(2, 9);
    // Add empty message to be filled
    setMessages(prev => [...prev, { id: messageId, sender: "coach", text: "" }]);
    
    const words = fullText.split(" ");
    let currentIdx = 0;
    let currentText = "";

    const timer = setInterval(() => {
      if (currentIdx < words.length) {
        currentText += (currentIdx === 0 ? "" : " ") + words[currentIdx];
        setMessages(prev => 
          prev.map(msg => msg.id === messageId ? { ...msg, text: currentText } : msg)
        );
        currentIdx++;
      } else {
        clearInterval(timer);
        setSending(false);
      }
    }, 65); // 65ms per word streaming speed
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = { id: Math.random().toString(36).substring(2, 9), sender: "user", text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setSending(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/ai/coach/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ message: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        simulateStreamingReply(data.reply);
      } else {
        const reply = simulateCoachReply(textToSend);
        simulateStreamingReply(reply);
      }
    } catch {
      const reply = simulateCoachReply(textToSend);
      simulateStreamingReply(reply);
    }
  };

  const simulateCoachReply = (text: string): string => {
    const q = text.toLowerCase();
    if (q.includes("transport") || q.includes("ev") || q.includes("hybrid")) {
      return "Commuting via public transit reduces emissions by over 80% compared to single-occupant petrol vehicles. Upgrading to a Battery EV yields carbon savings of ~2.5 tons annually. If that is unavailable, hybrid setups save about 35% carbon.";
    }
    if (q.includes("food") || q.includes("diet") || q.includes("beef") || q.includes("tofu")) {
      return "Beef is heavily carbon intensive, creating roughly 27kg CO2e per kg due to methane digestion. Plant proteins like tofu produce under 1.5kg CO2e. Swapping red meat for plant alternatives twice weekly cuts your dietary footprint by 30%.";
    }
    if (q.includes("compost") || q.includes("guide")) {
      return "Composting diverts organic waste from landfills, avoiding methane release during anaerobic decay. Instead, it generates rich aerobic soil. Log composted activities under Waste to claim streak XP bonuses!";
    }
    return "This is a great sustainability inquiry. Cutting your carbon budget involves swapping to electric transit modes, shifting domestic grid tariffs to renewables, and selecting plant-based diet options. What area would you like to drill down into?";
  };

  const handleGenerateRoadmap = async () => {
    setLoadingRoadmap(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/ai/copilot/roadmap`, { 
        method: "POST",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data: Roadmap = await res.json();
        setRoadmap(data);
      } else {
        // delay slightly to feel realistic
        setTimeout(() => {
          setRoadmap(FALLBACK_ROADMAP);
          setLoadingRoadmap(false);
        }, 1200);
      }
    } catch {
      setTimeout(() => {
        setRoadmap(FALLBACK_ROADMAP);
        setLoadingRoadmap(false);
      }, 1200);
    }
  };

  const clearChatFeed = () => {
    setMessages([{ id: "msg-1", sender: "coach", text: "Ecosystem reset. AI Sustainability Copilot online. How can I help you today?" }]);
    setRoadmap(null);
  };

  // Render Apple-Polished loading state
  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4 glass-card rounded-3xl border border-white/10 min-h-[400px]">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-brand-sky/20" />
        <div className="absolute inset-0 rounded-full border-4 border-t-brand-sky border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>
      <div className="flex flex-col gap-1 text-center">
        <span className="text-sm font-bold text-gray-200">Initializing Environment Mentor...</span>
        <span className="text-xs text-gray-500">Retrieving contextual memory vectors and roadmap models</span>
      </div>
    </div>
  );

  // Render Apple-Polished empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 gap-6 glass-card rounded-3xl border border-white/10 min-h-[400px] text-center">
      <div className="p-4 bg-brand-sky/10 text-brand-sky rounded-full border border-brand-sky/20">
        <Brain className="h-10 w-10 animate-pulse" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-sm">
        <span className="text-base font-extrabold text-white">No Active Consultations</span>
        <span className="text-xs text-gray-400 leading-normal">
          You haven't initiated an AI Coaching session. Type a sustainability question or select a prompt pill below to begin.
        </span>
      </div>
      <button 
        onClick={() => { setScreenState("success"); handleSendMessage("Give me a sustainability overview"); }}
        className="px-5 py-2.5 bg-brand-sky text-white font-bold rounded-xl text-xs hover:bg-sky-600 transition-colors"
      >
        Initiate AI Session
      </button>
    </div>
  );

  // Render Apple-Polished error state
  const renderErrorState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 gap-6 glass-card rounded-3xl border border-red-500/20 bg-red-500/5 min-h-[400px] text-center">
      <div className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
        <AlertTriangle className="h-10 w-10 animate-bounce" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-sm">
        <span className="text-base font-extrabold text-red-500">Connection Interrupted</span>
        <span className="text-xs text-gray-400 leading-normal">
          Failed to establish link with explainable AI prediction nodes. Please check your local server or retry connection.
        </span>
      </div>
      <button 
        onClick={() => setScreenState("success")}
        className="px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl text-xs hover:bg-red-600 transition-colors flex items-center gap-1.5"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Reconnect Telemetry</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-10 py-6">
      
      {/* Header & Apple state selector deck */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-brand-borderDark/30 pb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Cpu className="h-8 w-8 text-purple-400" />
            <span>AI Sustainability Copilot</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get personalized sustainability guidance, roadmaps, and challenges</p>
        </div>

        {/* Polished state deck selector */}
        <div className="flex items-center gap-1.5 p-1 bg-brand-cardDark border border-brand-borderDark/40 rounded-xl">
          {(["success", "loading", "empty", "error"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setScreenState(st)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                screenState === st
                  ? "bg-brand-emerald text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {screenState === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderLoadingState()}
          </motion.div>
        )}

        {screenState === "empty" && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderEmptyState()}
          </motion.div>
        )}

        {screenState === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderErrorState()}
          </motion.div>
        )}

        {screenState === "success" && (
          <motion.div 
            key="success"
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="grid gap-8 lg:grid-cols-3 text-left"
          >
            
            {/* Left Columns: Chat Console with Apple Intelligence glow */}
            <div className="glass-card rounded-3xl p-6 lg:col-span-2 flex flex-col h-[520px] relative overflow-hidden">
              
              {/* Apple Intelligence Glowing halo at top right when typing */}
              <div className={`absolute top-[-30px] right-[-30px] h-32 w-32 rounded-full blur-[40px] pointer-events-none transition-all duration-1000 -z-10 ${
                sending
                  ? "bg-gradient-to-r from-purple-500 via-sky-400 to-emerald-400 opacity-60 animate-spin-slow"
                  : "bg-purple-500/10 opacity-30"
              }`} />

              <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-borderDark/50 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20"><Brain className="h-5 w-5" /></div>
                  <div>
                    <h3 className="font-bold text-sm">Environmental Mentor</h3>
                    <span className="text-[10px] text-brand-emerald font-semibold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-emerald animate-ping" />
                      <span>Online • Context Memory Active</span>
                    </span>
                  </div>
                </div>

                <button 
                  onClick={clearChatFeed}
                  className="px-2.5 py-1.5 border border-brand-borderDark/40 hover:bg-brand-cardDark text-[10px] font-bold uppercase rounded-lg text-gray-400 hover:text-white"
                >
                  Clear Feed
                </button>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-4.5 pr-2 mb-4 scrollbar-thin scrollbar-thumb-brand-borderDark">
                {messages.map((msg) => {
                  const isCoach = msg.sender === "coach";
                  return (
                    <div 
                      key={msg.id}
                      className={`flex ${isCoach ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`flex gap-3 max-w-[85%] ${isCoach ? "flex-row" : "flex-row-reverse"}`}>
                        <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${
                          isCoach 
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                            : "bg-brand-emerald/10 border-brand-emerald/20 text-brand-emerald"
                        }`}>
                          {isCoach ? <Brain className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        <div className={`rounded-2xl p-4 text-xs leading-relaxed ${
                          isCoach 
                            ? "bg-gray-100 text-gray-800 dark:bg-brand-cardDark dark:text-gray-100 border border-gray-200/50 dark:border-brand-borderDark/30" 
                            : "bg-brand-emerald text-white"
                        }`}>
                          {msg.text === "" ? (
                            <span className="flex items-center gap-1 text-gray-400 animate-pulse">
                              <span>Thinking...</span>
                            </span>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sending && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="h-8 w-8 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                        <Brain className="h-4 w-4 animate-spin-slow" />
                      </div>
                      <div className="bg-gray-100 dark:bg-brand-cardDark rounded-2xl p-4 text-xs text-gray-400 animate-pulse leading-normal">
                        Formulating optimal sustainability roadmap response...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Preset prompt pills */}
              <div className="flex gap-2 overflow-x-auto py-2 mb-2 scrollbar-none border-t border-brand-borderDark/30 pt-3">
                {PROMPT_PILLS.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => handleSendMessage(pill)}
                    className="px-3 py-1.5 rounded-full border border-brand-borderDark bg-brand-cardDark/50 text-[10px] text-gray-400 hover:text-white hover:border-brand-emerald/40 transition-colors whitespace-nowrap"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              {/* Input form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question... e.g. 'How do I optimize transport?'"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-gray-50 dark:bg-brand-cardDark/50 border border-gray-200 dark:border-brand-borderDark rounded-xl px-4 py-3 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                  aria-label="Ask sustainability coach a question"
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="bg-brand-emerald hover:bg-brand-forest text-white p-3 rounded-xl transition-colors disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Right Column: Roadmap & Challenges */}
            <div className="flex flex-col gap-6">
              
              {/* Weekly Challenges Card */}
              <div className="glass-card rounded-3xl p-6 border border-white/20">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Award className="h-5.5 w-5.5 text-brand-emerald" />
                  <span>Weekly Challenges</span>
                </h3>

                <div className="flex flex-col gap-3">
                  {challenges.map((ch, idx) => (
                    <div key={idx} className="p-3 border border-gray-100 dark:border-brand-borderDark/40 rounded-xl bg-gray-50/50 dark:bg-brand-cardDark/30 flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald accent-brand-emerald cursor-pointer"
                        id={`challenge-${idx}`}
                      />
                      <div className="flex-1">
                        <label htmlFor={`challenge-${idx}`} className="text-xs font-bold text-gray-800 dark:text-white cursor-pointer hover:text-brand-emerald transition-colors">
                          {ch.title}
                        </label>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                          {ch.description}
                        </p>
                        <div className="flex gap-3 mt-2 text-[9px] font-bold text-brand-emerald">
                          <span>+{ch.xp} XP</span>
                          <span>•</span>
                          <span>-{ch.co2_saving} kg CO2e</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roadmap Generator Card */}
              <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Map className="h-5.5 w-5.5 text-brand-sky" />
                  <span>Reduction Roadmap</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                  Compile a personalized, multi-phase pathway to neutralize your annual footprint targets.
                </p>

                {!roadmap ? (
                  <button
                    onClick={handleGenerateRoadmap}
                    disabled={loadingRoadmap}
                    className="w-full bg-brand-emerald hover:bg-brand-forest text-white font-bold py-2.5 rounded-xl shadow-md transition-colors disabled:opacity-50 text-xs"
                  >
                    {loadingRoadmap ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Compiling custom nodes...</span>
                      </div>
                    ) : (
                      <span>Compile Custom Roadmap</span>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 bg-brand-emerald/10 border border-brand-emerald/20 rounded-xl text-center">
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Projected Annual Savings</span>
                      <span className="block text-lg font-extrabold text-brand-emerald mt-1">-{roadmap.total_projected_savings_annual_kg} kg CO2e</span>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[170px] flex flex-col gap-2 pr-1 scrollbar-thin scrollbar-thumb-brand-borderDark">
                      {roadmap.steps.map((step, sIdx) => (
                        <div key={sIdx} className="p-2.5 border border-gray-100 dark:border-brand-borderDark/40 rounded-lg text-[10px] leading-relaxed">
                          <span className="font-bold text-brand-emerald block mb-1">{step.phase}</span>
                          <ul className="list-disc pl-4 text-gray-600 dark:text-gray-400 flex flex-col gap-1">
                            {step.actions.map((act, aIdx) => (
                              <li key={aIdx}>{act}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setRoadmap(null)}
                      className="w-full border border-gray-200 dark:border-brand-borderDark hover:bg-gray-100 dark:hover:bg-brand-cardDark text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                    >
                      Reset Roadmap
                    </button>
                  </div>
                )}
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
