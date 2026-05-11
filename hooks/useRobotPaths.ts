import { useRos } from '@/context/RosContext';
import { useEffect, useRef, useState } from 'react';

export interface RobotPath {
  /** Array of waypoints as [x, z] pairs (Three.js coordinates) */
  waypoints: Array<{ x: number; z: number }>;
}

export type RobotPathMap = Record<string, RobotPath>;

// ─── Mock mode ───────────────────────────────────────────────────────────────
// Set to true to simulate robot paths without a live ROS connection.
const MOCK_PATHS = true;
const MOCK_UPDATE_MS = 100; // how often to update mock paths (ms)

/**
 * Generate a mock path for testing. Creates a simple square path around the robot's area.
 */
function generateMockPath(botName: string, idx: number): RobotPath {
  const waypoints: Array<{ x: number; z: number }> = [];
  const cx = 2.5;
  const cz = 1.5;
  const ovalRadiusX = 1.7;
  const ovalRadiusZ = 0.7;
  const numPoints = 64; // High resolution for smooth glowing curve

  // Generate waypoints along the oval track
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    waypoints.push({
      x: cx + ovalRadiusX * Math.cos(angle),
      z: cz + ovalRadiusZ * Math.sin(angle),
    });
  }

  return { waypoints };
}

/**
 * Subscribes to `/<botName>/path` (nav_msgs/Path) for every name in `botNames`.
 * Extracts waypoints and converts from ROS coords to Three.js coords.
 * When MOCK_PATHS is true, generates synthetic paths for testing.
 *
 * ROS coordinate mapping (same as poses):
 *   path.poses[].pose.position.x  → Three.js X
 *   path.poses[].pose.position.y  → Three.js Z  (ROS Y is forward)
 */
export function useRobotPaths(botNames: string[]): RobotPathMap {
  const { getMessage, isConnected } = useRos();
  const [paths, setPaths] = useState<RobotPathMap>({});
  const subscribedRef = useRef<Set<string>>(new Set());

  // When MOCK_PATHS is enabled, generate synthetic paths immediately
  useEffect(() => {
    if (!MOCK_PATHS || botNames.length === 0) return;

    const next: RobotPathMap = {};
    botNames.forEach((name, idx) => {
      next[name] = generateMockPath(name, idx);
    });
    setPaths(next);
  }, [botNames.join(',')]);

  // When MOCK_PATHS is disabled, subscribe to real ROS path topics
  useEffect(() => {
    if (MOCK_PATHS || !isConnected || botNames.length === 0) return;

    botNames.forEach((name) => {
      if (subscribedRef.current.has(name)) return;
      subscribedRef.current.add(name);

      getMessage(
        `/${name}/path`,
        'nav_msgs/Path',
        (msg: any) => {
          const poseArray = msg?.poses;
          if (!Array.isArray(poseArray)) {
            // No path data yet, set empty
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
                x: pos.x ?? 0,
                z: pos.y ?? 0, // ROS Y → Three.js Z
              };
            })
            .filter((wp: any) => wp !== null);

          setPaths((prev) => ({
            ...prev,
            [name]: { waypoints },
          }));
        },
      );
    });
  }, [isConnected, botNames.join(',')]);

  return paths;
}
