/**
 * RosContext (MultiRosContext)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all ROS connections.
 *
 * • As soon as a real (non-mock) duckiebot appears in DuckiebotContext, a
 *   WebSocket connection is opened and kept alive forever (auto-reconnect with
 *   exponential backoff).
 * • Consumers call subscribe() / publish() / serviceCall() on this context.
 *   ActiveDuckiebotContext wraps these with a scoped shortcut for the currently
 *   selected robot.
 *
 * Provider hierarchy requirement:
 *   <DuckiebotProvider>        ← discovers robots
 *     <MultiRosProvider>       ← this file; connects to each discovered robot
 *       …children…
 *     </MultiRosProvider>
 *   </DuckiebotProvider>
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ROSLIB = require("../utils/roslib.js");

import "text-encoding";
import { useDiscoveredDuckiebotInfo } from "./DuckiebotContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotConnection {
  ros: any;
  isConnected: boolean;
  ip: string;
  reconnectAttempts: number;
}

export interface MultiRosContextType {
  // Per-bot status
  getBotConnectionStatus: (botName: string) => boolean;
  getAllBotStatuses: () => Record<string, boolean>;
  getBotRos: (botName: string) => any;

  // Per-bot subscriptions
  subscribeToBot: (
    botName: string,
    topicName: string,
    messageType: string,
    callback: (msg: any) => void,
  ) => () => void;

  // Per-bot publishing
  sendMessageToBot: (
    botName: string,
    topicName: string,
    messageType: string,
    payload: any,
  ) => void;

  // Per-bot service calls
  callServiceOnBot: (
    botName: string,
    serviceName: string,
    serviceType: string,
    args: any,
  ) => Promise<any>;
}

// ── BotConnectionManager ──────────────────────────────────────────────────────

class BotConnectionManager {
  private connections: Map<string, BotConnection> = new Map();
  private activeTopics: Map<string, any[]> = new Map();
  private pendingSubscriptions: Map<
    string,
    Array<{
      topicName: string;
      messageType: string;
      callback: (msg: any) => void;
    }>
  > = new Map();
  private RosConstructor: any;
  private onStatusChange: (statuses: Record<string, boolean>) => void;

  constructor(
    RosConstructor: any,
    onStatusChange: (statuses: Record<string, boolean>) => void,
  ) {
    this.RosConstructor = RosConstructor;
    this.onStatusChange = onStatusChange;
  }

  connectToBot(botName: string, ip: string) {
    // Already connected or connecting — skip
    if (this.connections.has(botName)) {
      const existing = this.connections.get(botName)!;
      if (existing.isConnected) {
        console.log(`[${botName}] Already connected — skipping`);
        return;
      }
    }

    const cleanIp = ip.trim();
    const isValidHost =
      /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp) ||
      /^[a-zA-Z0-9.-]+$/.test(cleanIp);

    if (!isValidHost) {
      console.warn(`[${botName}] Invalid IP/host: ${cleanIp}`);
      return;
    }

    const url = `ws://${cleanIp}:9001`;
    console.log(`[${botName}] Connecting to ROS at ${url}`);

    try {
      const ros = new this.RosConstructor({ encoding: "ascii" });

      const connection: BotConnection = {
        ros,
        isConnected: false,
        ip: cleanIp,
        reconnectAttempts: 0,
      };

      ros.on("connection", () => {
        console.log(`[${botName}] ROS connected!`);
        connection.isConnected = true;
        connection.reconnectAttempts = 0;
        this.notifyStatusChange();
        this.processPendingSubscriptions(botName);
      });

      ros.on("error", (error: any) => {
        console.log(`[${botName}] ROS connection error:`, error);
        connection.isConnected = false;
        this.scheduleReconnect(botName);
      });

      ros.on("close", () => {
        console.log(`[${botName}] ROS connection closed — will reconnect`);
        connection.isConnected = false;
        this.scheduleReconnect(botName);
      });

      this.connections.set(botName, connection);
      ros.connect(url);
    } catch (err) {
      console.error(`[${botName}] Failed to create ROS connection:`, err);
    }
  }

  private scheduleReconnect(botName: string) {
    const connection = this.connections.get(botName);
    if (!connection) return;

    connection.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, connection.reconnectAttempts - 1),
      30_000,
    );

    console.log(
      `[${botName}] Reconnect attempt ${connection.reconnectAttempts} in ${delay}ms`,
    );

    setTimeout(() => {
      if (!connection.isConnected) {
        this.connectToBot(botName, connection.ip);
      }
    }, delay);

    this.notifyStatusChange();
  }

  getBotRos(botName: string): any {
    return this.connections.get(botName)?.ros ?? null;
  }

  isBotConnected(botName: string): boolean {
    return this.connections.get(botName)?.isConnected ?? false;
  }

  getAllStatuses(): Record<string, boolean> {
    const statuses: Record<string, boolean> = {};
    this.connections.forEach((conn, botName) => {
      statuses[botName] = conn.isConnected;
    });
    return statuses;
  }

  subscribeToBot(
    botName: string,
    topicName: string,
    messageType: string,
    callback: (msg: any) => void,
  ): () => void {
    let topic: any = null;

    const doSubscribe = (ros: any) => {
      try {
        const TopicClass = ROSLIB.Topic || (global as any).ROSLIB?.Topic;
        if (!TopicClass) {
          console.warn("ROSLIB.Topic not available");
          return;
        }

        topic = new TopicClass({ ros, name: topicName, messageType });
        topic.subscribe((message: any) => callback(message));
        console.log(`[${botName}] Subscribed to ${topicName}`);

        if (!this.activeTopics.has(botName)) {
          this.activeTopics.set(botName, []);
        }
        this.activeTopics.get(botName)!.push(topic);
      } catch (err) {
        console.error(`[${botName}] Subscription error on ${topicName}:`, err);
      }
    };

    const ros = this.getBotRos(botName);

    if (ros && this.isBotConnected(botName)) {
      // Connection is already live — subscribe immediately
      doSubscribe(ros);
    } else if (ros) {
      // Connection object exists but not yet connected — wait for it
      const handler = () => {
        doSubscribe(ros);
        ros.removeListener("connection", handler);
      };
      ros.on("connection", handler);
    } else {
      // Bot not yet known — queue for when connectToBot is called
      if (!this.pendingSubscriptions.has(botName)) {
        this.pendingSubscriptions.set(botName, []);
      }
      this.pendingSubscriptions
        .get(botName)!
        .push({ topicName, messageType, callback });
    }

    return () => {
      if (topic && typeof topic.unsubscribe === "function") {
        topic.unsubscribe();
        console.log(`[${botName}] Unsubscribed from ${topicName}`);

        const topics = this.activeTopics.get(botName);
        if (topics) {
          const idx = topics.indexOf(topic);
          if (idx > -1) topics.splice(idx, 1);
        }
      }
    };
  }

  private processPendingSubscriptions(botName: string) {
    const pending = this.pendingSubscriptions.get(botName);
    if (!pending || pending.length === 0) return;

    console.log(`[${botName}] Processing ${pending.length} queued subscriptions`);
    const ros = this.getBotRos(botName);
    if (!ros) return;

    pending.forEach(({ topicName, messageType, callback }) => {
      try {
        const TopicClass = ROSLIB.Topic || (global as any).ROSLIB?.Topic;
        if (!TopicClass) return;

        const topic = new TopicClass({ ros, name: topicName, messageType });
        topic.subscribe((message: any) => callback(message));

        console.log(`[${botName}] Subscribed to queued topic ${topicName}`);

        if (!this.activeTopics.has(botName)) {
          this.activeTopics.set(botName, []);
        }
        this.activeTopics.get(botName)!.push(topic);
      } catch (err) {
        console.error(`[${botName}] Failed queued subscribe to ${topicName}:`, err);
      }
    });

    this.pendingSubscriptions.delete(botName);
  }

  sendMessageToBot(
    botName: string,
    topicName: string,
    messageType: string,
    payload: any,
  ) {
    const ros = this.getBotRos(botName);
    if (!ros || !this.isBotConnected(botName)) {
      console.warn(`[${botName}] Not connected — cannot publish to ${topicName}`);
      return;
    }

    try {
      const TopicClass = ROSLIB.Topic || (global as any).ROSLIB?.Topic;
      const MessageClass = ROSLIB.Message || (global as any).ROSLIB?.Message;
      if (!TopicClass || !MessageClass) return;

      const topic = new TopicClass({ ros, name: topicName, messageType });
      topic.publish(new MessageClass(payload));
    } catch (err) {
      console.error(`[${botName}] Publish error on ${topicName}:`, err);
    }
  }

  callServiceOnBot(
    botName: string,
    serviceName: string,
    serviceType: string,
    args: any,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const ros = this.getBotRos(botName);
      if (!ros || !this.isBotConnected(botName)) {
        reject(`[${botName}] ROS not connected`);
        return;
      }

      try {
        const ServiceClass = ROSLIB.Service || (global as any).ROSLIB?.Service;
        const ServiceRequestClass =
          ROSLIB.ServiceRequest || (global as any).ROSLIB?.ServiceRequest;
        if (!ServiceClass || !ServiceRequestClass) {
          reject("Service/ServiceRequest class not found in ROSLIB.");
          return;
        }

        const service = new ServiceClass({ ros, name: serviceName, serviceType });
        service.callService(
          new ServiceRequestClass(args),
          (result: any) => resolve(result),
          (error: any) => reject(error),
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  private notifyStatusChange() {
    this.onStatusChange(this.getAllStatuses());
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const MultiRosContext = createContext<MultiRosContextType | undefined>(
  undefined,
);

export const MultiRosProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [botStatuses, setBotStatuses] = useState<Record<string, boolean>>({});
  const managerRef = useRef<BotConnectionManager | null>(null);

  // Initialise the manager once
  useEffect(() => {
    if (!ROSLIB) {
      console.error("ROSLIB module could not be loaded.");
      return;
    }

    let RosConstructor: any;
    if (typeof ROSLIB.Ros === "function") {
      RosConstructor = ROSLIB.Ros;
    } else if (typeof ROSLIB === "function") {
      RosConstructor = ROSLIB;
    } else {
      RosConstructor = (global as any).ROSLIB?.Ros;
    }

    if (!RosConstructor) {
      console.error("ROSLIB.Ros constructor could not be found.");
      return;
    }

    managerRef.current = new BotConnectionManager(RosConstructor, setBotStatuses);
  }, []);

  // Auto-connect: whenever a new real robot is discovered, open its connection
  const { data: discoveredBots } = useDiscoveredDuckiebotInfo();

  useEffect(() => {
    if (!managerRef.current) return;

    discoveredBots.forEach((bot) => {
      // Skip mock robots — they have no real ROS bridge
      if (bot.isMock) return;

      managerRef.current!.connectToBot(bot.name, bot.ip);
    });
  }, [discoveredBots]);

  // ── Context API ────────────────────────────────────────────────────────────

  const getBotConnectionStatus = (botName: string): boolean =>
    managerRef.current?.isBotConnected(botName) ?? false;

  const getAllBotStatuses = (): Record<string, boolean> =>
    managerRef.current?.getAllStatuses() ?? {};

  const getBotRos = (botName: string): any =>
    managerRef.current?.getBotRos(botName) ?? null;

  const subscribeToBot = (
    botName: string,
    topicName: string,
    messageType: string,
    callback: (msg: any) => void,
  ): (() => void) =>
    managerRef.current?.subscribeToBot(botName, topicName, messageType, callback) ??
    (() => {});

  const sendMessageToBot = (
    botName: string,
    topicName: string,
    messageType: string,
    payload: any,
  ) =>
    managerRef.current?.sendMessageToBot(botName, topicName, messageType, payload);

  const callServiceOnBot = (
    botName: string,
    serviceName: string,
    serviceType: string,
    args: any,
  ): Promise<any> =>
    managerRef.current?.callServiceOnBot(botName, serviceName, serviceType, args) ??
    Promise.reject("ROS manager not initialised");

  return (
    <MultiRosContext.Provider
      value={{
        getBotConnectionStatus,
        getAllBotStatuses,
        getBotRos,
        subscribeToBot,
        sendMessageToBot,
        callServiceOnBot,
      }}
    >
      {children}
    </MultiRosContext.Provider>
  );
};

export const useMultiRos = () => {
  const context = useContext(MultiRosContext);
  if (!context)
    throw new Error("useMultiRos must be used within a MultiRosProvider");
  return context;
};

// Backward-compatibility aliases
export const RosProvider = MultiRosProvider;
export const useRos = useMultiRos;
