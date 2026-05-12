import { useMultiRos } from "@/context/RosContext";
import { useEffect, useRef, useState } from "react";

export interface RobotPath {
  /** Array of waypoints as [x, z] pairs (Three.js coordinates) */
  waypoints: Array<{ x: number; z: number }>;
}

export type RobotPathMap = Record<string, RobotPath>;

/**
 * Subscribes to `/<botName>/path` (nav_msgs/Path) for every name in `botNames`.
 * Extracts waypoints and converts from ROS coords to Three.js coords.
 *
 * ROS coordinate mapping (same as poses):
 *   path.poses[].pose.position.x  → Three.js X
 *   path.poses[].pose.position.y  → Three.js Z  (ROS Y is forward)
 */
export function useRobotPaths(botNames: string[]): RobotPathMap {
  const { subscribeToBot } = useMultiRos();
  const [paths, setPaths] = useState<RobotPathMap>({});
  const subscribedRef = useRef<Set<string>>(new Set());

  // Subscribe to real ROS path topics
  useEffect(() => {
    if (botNames.length === 0) return;

    botNames.forEach((name) => {
      if (subscribedRef.current.has(name)) return;
      subscribedRef.current.add(name);

      subscribeToBot(name, `/${name}/graph_search_create_global_path/global_path`, "nav_msgs/Path", (msg: any) => {
        const poseArray = msg?.poses;
        console.log(msg)
        if (!Array.isArray(poseArray)) {
          setPaths((prev) => ({
            ...prev,
            [name]: { waypoints: [] },
          }));
          return;
        }

        // Extract waypoints from path
        const waypoints = poseArray
          .map((poseStamped: any) => {
            const pos = poseStamped?.pose?.position;
            if (!pos) return null;
            return {
              x: pos.y * (10 / 6),
              z: pos.x * (10 / 6),
            };
          })
          .filter((wp: any): wp is { x: number; z: number } => wp !== null);

        setPaths((prev) => ({
          ...prev,
          [name]: { waypoints },
        }));
      });
    });
  }, [botNames.join(",")]);

  return paths;
}
