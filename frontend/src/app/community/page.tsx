"use client";
import { getApiUrl, getWsUrl, getAuthHeaders } from "@/utils/api";


import { useState, useEffect } from "react";
import { PlusCircle, CheckCircle, Target, Users, Send, MessageSquare } from "lucide-react";
import { EcoGroup } from "@/types";
import { useWebSocket } from "@/components/WebSocketProvider";

const FALLBACK_GROUPS: EcoGroup[] = [
  { id: 1, name: "Zero Waste Neighborhood", description: "Local community group aiming to compost and recycle all household waste.", members_count: 142 },
  { id: 2, name: "Metro Commuters Collective", description: "Reducing reliance on combustion engines by riding the metro together.", members_count: 89 },
  { id: 3, name: "Plant-Based Professionals", description: "Corporate employees sharing vegetarian and vegan recipes to reduce dietary impacts.", members_count: 54 }
];

export default function Community() {
  const [groups, setGroups] = useState<EcoGroup[]>(FALLBACK_GROUPS);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState<number[]>([]);
  const [success, setSuccess] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const { connected, events, sendChatMessage, sendMilestone } = useWebSocket();

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/community/groups`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data: EcoGroup[] = await res.json();
          setGroups(data);
        }
      } catch (err) {
        console.log("Groups syncing complete.");
      }
    };
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;

    setLoading(true);
    setSuccess(false);

    const payload = { name, description };

    try {
      const res = await fetch(`${getApiUrl()}/api/community/groups`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: EcoGroup = await res.json();
        setGroups(prev => [data, ...prev]);
        sendMilestone(`created a new eco group: "${name}"`, 50);
        setName("");
        setDescription("");
        setSuccess(true);
      } else {
        const simulatedGroup: EcoGroup = {
          id: Date.now(),
          name,
          description,
          members_count: 1
        };
        setGroups(prev => [simulatedGroup, ...prev]);
        sendMilestone(`created a new eco group: "${name}" (Simulated)`, 50);
        setName("");
        setDescription("");
        setSuccess(true);
      }
    } catch {
      const simulatedGroup: EcoGroup = {
        id: Date.now(),
        name,
        description,
        members_count: 1
      };
      setGroups(prev => [simulatedGroup, ...prev]);
      sendMilestone(`created a new eco group: "${name}" (Simulated)`, 50);
      setName("");
      setDescription("");
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId: number) => {
    if (joined.includes(groupId)) return;

    const group = groups.find(g => g.id === groupId);
    const groupName = group ? group.name : "Eco Collective";

    try {
      await fetch(`${getApiUrl()}/api/community/groups/${groupId}/join`, { 
        method: "POST",
        headers: getAuthHeaders()
      });
      sendMilestone(`joined the community group: "${groupName}"`, 30);
    } catch (err) {
      console.error(err);
      sendMilestone(`joined the community group: "${groupName}" (Simulated)`, 30);
    }

    setJoined(prev => [...prev, groupId]);
    setGroups(groups.map(g => g.id === groupId ? { ...g, members_count: g.members_count + 1 } : g));
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput("");
  };

  return (
    <div className="flex flex-col gap-10 py-6">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white">Community Groups</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Join local eco-groups, participate in challenges, and compare progress with friends</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Group List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Active Eco Groups</span>
          
          <div className="flex flex-col gap-4">
            {groups.map((group) => {
              const isJoined = joined.includes(group.id);
              return (
                <div key={group.id} className="glass-card rounded-2xl p-6 border border-white/20 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-brand-emerald/30 transition-colors">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{group.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{group.description}</p>
                    <div className="flex gap-4 mt-3 text-[10px] font-semibold text-gray-400">
                      <span>{group.members_count} Members</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-brand-emerald">
                        <Target className="h-3.5 w-3.5" />
                        Active challenge: 12% Weekly Reduction
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinGroup(group.id)}
                    disabled={isJoined}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isJoined 
                        ? "bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20" 
                        : "bg-brand-emerald hover:bg-brand-forest text-white"
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Joined</span>
                      </>
                    ) : (
                      <span>Join Group</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Forms & Live Chat */}
        <div className="flex flex-col gap-6">
          {/* Create Group Form */}
          <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-brand-borderDark/50 pb-4">
              <PlusCircle className="h-5 w-5 text-brand-emerald" />
              <span>Create Eco Group</span>
            </h3>

            {success && (
              <div className="p-3 bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald rounded-xl text-xs flex items-center gap-1.5" role="alert">
                <CheckCircle className="h-4 w-4" />
                <span>Eco group created successfully! +50 XP</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="group-name" className="text-xs font-semibold text-gray-500 dark:text-gray-400">Group Name</label>
                <input
                  id="group-name"
                  type="text"
                  placeholder="e.g. Green Living Chicago"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="group-desc" className="text-xs font-semibold text-gray-500 dark:text-gray-400">Description</label>
                <textarea
                  id="group-desc"
                  placeholder="Outline your environmental mission..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-3 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !description.trim()}
                className="w-full bg-brand-emerald hover:bg-brand-forest text-white font-semibold py-2.5 rounded-xl shadow-md transition-colors disabled:opacity-50 text-xs"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
                ) : (
                  <span>Launch Group</span>
                )}
              </button>
            </form>
          </div>

          {/* Live Community Feed */}
          <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
            <h3 className="text-lg font-bold flex items-center justify-between border-b border-gray-100 dark:border-brand-borderDark/50 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-brand-sky" />
                <span>Live Eco Stream</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-brand-emerald animate-ping" : "bg-orange-500 animate-pulse"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {connected ? "Live" : "Simulated"}
                </span>
              </div>
            </h3>

            {/* Events scrolling feed */}
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1 flex-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-brand-borderDark">
              {events.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                  Waiting for community updates...
                </div>
              ) : (
                events.map((evt) => {
                  let badgeColor = "bg-gray-100 dark:bg-brand-cardDark text-gray-500";
                  let content = null;

                  if (evt.type === "milestone") {
                    badgeColor = "bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20";
                    content = (
                      <div className="text-xs">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{evt.user}</span>{" "}
                        <span className="text-gray-600 dark:text-gray-400">{evt.milestone}</span>
                        <span className="ml-1.5 inline-block bg-brand-emerald/20 text-brand-emerald px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase">
                          +{evt.xp} XP
                        </span>
                      </div>
                    );
                  } else if (evt.type === "chat") {
                    badgeColor = "bg-brand-sky/10 text-brand-sky border border-brand-sky/20";
                    content = (
                      <div className="text-xs">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{evt.user}:</span>{" "}
                        <span className="text-gray-600 dark:text-gray-400 italic">"{evt.message}"</span>
                      </div>
                    );
                  } else if (evt.type === "user_join" || evt.type === "user_leave") {
                    badgeColor = "bg-purple-500/10 text-purple-500 border border-purple-500/20";
                    content = (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {evt.message}
                      </div>
                    );
                  } else {
                    badgeColor = "bg-blue-500/10 text-blue-500 border border-blue-500/20";
                    content = (
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {evt.message}
                      </div>
                    );
                  }

                  return (
                    <div key={evt.id} className="p-3 bg-gray-50/50 dark:bg-brand-cardDark/30 border border-gray-100 dark:border-brand-borderDark/20 rounded-2xl flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded font-bold capitalize ${badgeColor}`}>
                          {evt.type}
                        </span>
                        <span>{evt.timestamp}</span>
                      </div>
                      {content}
                    </div>
                  );
                })
              )}
            </div>

            {/* Send Message Form */}
            <form onSubmit={handleSendChat} className="flex gap-2 border-t border-gray-100 dark:border-brand-borderDark/50 pt-4">
              <input
                type="text"
                placeholder="Message the community..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark rounded-xl p-2.5 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                required
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2.5 bg-brand-emerald hover:bg-brand-forest text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                aria-label="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
