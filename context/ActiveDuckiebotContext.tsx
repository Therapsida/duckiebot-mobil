/**
 * ActiveDuckiebotContext
 * ─────────────────────────────────────────────────────────────────────────────
 * A thin scoped view over MultiRosContext for whichever bot is currently
 * selected (identified by the `id` route param).
 *
 * This context owns ZERO connection logic. All connections are established
 * and maintained by MultiRosProvider as soon as robots are discovered.
 *
 * Public API:
 *   subscribe(topicName, msgType, cb)   → auto-prefixes /<botName>
 *   publish(topicName, msgType, payload) → auto-prefixes /<botName>
 *   serviceCall(svcName, svcType, args)  → auto-prefixes /<botName>
 *   connectionStatus                     → 'connecting' | 'connected' | 'idle' | 'failed'
 */

import { DiscoveredRobotInfo } from "@/utils/mdns";
import { useLocalSearchParams } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useDiscoveredDuckiebotInfo } from "./DuckiebotContext";
import { useMultiRos } from "./RosContext";

interface ActiveRobotContextType {
  duckiebot: DiscoveredRobotInfo | null;
  connectionStatus:
    | "idle"
    | "searching"
    | "connecting"
    | "connected"
    | "failed";
  subscribe: (
    topicName: string,
    messageType: string,
    callback: (msg: any) => void,
  ) => () => void;
  publish: (topicName: string, messageType: string, payload: any) => void;
  serviceCall: (
    serviceName: string,
    serviceType: string,
    args: any,
  ) => Promise<any>;
}

const ActiveRobotContext = createContext<ActiveRobotContextType | undefined>(
  undefined,
);

export const ActiveRobotProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: duckiebots } = useDiscoveredDuckiebotInfo();
  const { getBotConnectionStatus, subscribeToBot, sendMessageToBot, callServiceOnBot } =
    useMultiRos();

  // Find the active duckiebot from the discovered list
  const duckiebot = duckiebots.find((r) => r.name === id) ?? null;

  // Derive connection status reactively (poll every 500ms)
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "searching" | "connecting" | "connected" | "failed"
  >("idle");

  useEffect(() => {
    if (!duckiebot) {
      // Still looking for the robot in discovery results
      setConnectionStatus(id ? "searching" : "idle");
      return;
    }

    // Poll the manager for connection state
    const check = () => {
      const connected = getBotConnectionStatus(duckiebot.name);
      setConnectionStatus(connected ? "connected" : "connecting");
    };

    check(); // immediate
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [duckiebot, duckiebot?.name, getBotConnectionStatus, id]);

  // ── Scoped subscribe ────────────────────────────────────────────────────────
  const subscribe = useCallback(
    (topicName: string, messageType: string, callback: (msg: any) => void) => {
      if (!duckiebot) return () => {};
      return subscribeToBot(
        duckiebot.name,
        `/${duckiebot.name}${topicName}`,
        messageType,
        callback,
      );
    },
    [duckiebot, subscribeToBot],
  );

  // ── Scoped publish ─────────────────────────────────────────────────────────
  const publish = useCallback(
    (topicName: string, messageType: string, payload: any) => {
      if (!duckiebot) return;
      sendMessageToBot(
        duckiebot.name,
        `/${duckiebot.name}${topicName}`,
        messageType,
        payload,
      );
    },
    [duckiebot, sendMessageToBot],
  );

  // ── Scoped service call ────────────────────────────────────────────────────
  const serviceCall = useCallback(
    async (serviceName: string, serviceType: string, args: any) => {
      if (!duckiebot) return Promise.reject("No active duckiebot");
      return callServiceOnBot(
        duckiebot.name,
        `/${duckiebot.name}${serviceName}`,
        serviceType,
        args,
      );
    },
    [duckiebot, callServiceOnBot],
  );

  return (
    <ActiveRobotContext.Provider
      value={{
        duckiebot,
        connectionStatus,
        subscribe,
        publish,
        serviceCall,
      }}
    >
      {children}
    </ActiveRobotContext.Provider>
  );
};

export const useActiveDuckiebot = () => {
  const context = useContext(ActiveRobotContext);
  if (!context)
    throw new Error(
      "useActiveDuckiebot must be used within an ActiveRobotProvider",
    );
  return context;
};
