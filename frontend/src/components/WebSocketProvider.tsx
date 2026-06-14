"use client";
import { getApiUrl, getWsUrl } from "@/utils/api";


import React, { createContext, useContext, useEffect, useState, useRef } from "react";

export interface WebSocketEvent {
  id: string;
  type: "user_join" | "user_leave" | "chat" | "milestone" | "system";
  user: string;
  message?: string;
  milestone?: string;
  xp?: number;
  timestamp: string;
}

interface WebSocketContextType {
  connected: boolean;
  events: WebSocketEvent[];
  sendChatMessage: (message: string) => void;
  sendMilestone: (milestone: string, xp: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

const MOCK_NAMES = ["GreenWarrior", "EcoChamp", "SolarPioneer", "RecycleQueen", "ForestGuard"];
const MOCK_MILESTONES = [
  { text: "completed a 5km bike commute instead of driving!", xp: 30 },
  { text: "logged 3 vegetarian meals in a row!", xp: 45 },
  { text: "reduced home energy usage by 15% today!", xp: 50 },
  { text: "offset 500kg of CO2 via the Amazon Basin Project!", xp: 100 },
  { text: "completed the Carbon Footprint Foundations quiz!", xp: 50 }
];
const MOCK_CHATS = [
  "Just joined the Zero Waste group! Excited to learn from everyone.",
  "What is the best way to recycle electronic waste around here?",
  "Swapped to LED bulbs today, highly recommend it!",
  "Managed to get my daily carbon score down to 4.2 kg today!",
  "Great job on the leaderboards Alice!"
];

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Helper to add events
  const addEvent = (event: Omit<WebSocketEvent, "id" | "timestamp">) => {
    const newEvent: WebSocketEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    setEvents((prev) => [newEvent, ...prev].slice(0, 50)); // keep last 50 events
  };

  const connect = () => {
    if (wsRef.current) return;

    try {
      const ws = new WebSocket(`${getWsUrl()}/ws/community`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
        addEvent({
          type: "system",
          user: "System",
          message: "Connected to real-time community server."
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent({
            type: data.type,
            user: data.user,
            message: data.message,
            milestone: data.milestone,
            xp: data.xp
          });
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        triggerReconnect();
      };

      ws.onerror = () => {
        setConnected(false);
        ws.close();
      };
    } catch (err) {
      triggerReconnect();
    }
  };

  const triggerReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    
    // Exponential backoff up to 30 seconds
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  };

  useEffect(() => {
    connect();

    // Setup mock simulation interval when offline or even online to keep community active
    const interval = setInterval(() => {
      // 30% chance to simulate a mock event every 8 seconds if not connected, or 5% when connected
      const chance = connected ? 0.05 : 0.35;
      if (Math.random() < chance) {
        const isMilestone = Math.random() > 0.4;
        const user = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
        
        if (isMilestone) {
          const milestone = MOCK_MILESTONES[Math.floor(Math.random() * MOCK_MILESTONES.length)];
          const mockMsg = {
            type: "milestone" as const,
            user,
            milestone: milestone.text,
            xp: milestone.xp
          };
          addEvent(mockMsg);
        } else {
          const message = MOCK_CHATS[Math.floor(Math.random() * MOCK_CHATS.length)];
          const mockMsg = {
            type: "chat" as const,
            user,
            message
          };
          addEvent(mockMsg);
        }
      }
    }, 8000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(interval);
    };
  }, [connected]);

  const sendChatMessage = (message: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: "chat", message }));
    } else {
      addEvent({
        type: "chat",
        user: "You",
        message
      });
    }
  };

  const sendMilestone = (milestone: string, xp: number) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: "milestone", milestone, xp }));
    } else {
      addEvent({
        type: "milestone",
        user: "You",
        milestone,
        xp
      });
    }
  };

  return (
    <WebSocketContext.Provider value={{ connected, events, sendChatMessage, sendMilestone }}>
      {children}
    </WebSocketContext.Provider>
  );
};
