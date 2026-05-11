import { useRos } from '@/context/RosContext';
import { useEffect, useRef, useState } from 'react';

export interface RobotPose {
  x: number;
  z: number;
  /** Yaw in radians (rotation around Y axis in Three.js coords) */
  yaw: number;
}

export type RobotPoseMap = Record<string, RobotPose>;

// ─── Mock mode ───────────────────────────────────────────────────────────────
// Set to true to simulate robot movement without a live ROS connection.
const MOCK_POSES = true;
const MOCK_UPDATE_MS = 50; // how often to emit a new fake pose (ms)

/**
 * Each bot gets its own orbit: a circle with a unique radius, speed, phase, and center point (cx, cz).
 * The robot also turns to face the direction of travel (tangent of the circle).
 */
const MOCK_PARAMS: Record<string, { speed: number; phase: number; cx: number; cz: number }> = {
  'Bot-1': { speed: 0.8, phase: 0, cx: 2.5, cz: 1.5 }, // Track Center
  'Bot-2': { speed: 0.8, phase: Math.PI, cx: 2.5, cz: 1.5 }, // Track Center (opposite side)
};

function getMockParams(name: string, idx: number) {
  return (
    MOCK_PARAMS[name] ?? {
      speed: 0.8,
      phase: idx * Math.PI,
      cx: 2.5,
      cz: 1.5,
    }
  );
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to `/<botName>/pose` (geometry_msgs/PoseStamped) for every name
 * in `botNames`.  When MOCK_POSES is true the hook simulates circular motion
 * so you can verify smooth transitions without a live ROS connection.
 *
 * ROS coordinate mapping:
 *   pose.position.x  → Three.js X
 *   pose.position.y  → Three.js Z  (ROS Y is forward; we map it to depth)
 *   pose.orientation → quaternion  → yaw
 */
export function useRobotPoses(botNames: string[]): RobotPoseMap {
  const { getMessage, isConnected } = useRos();
  const [poses, setPoses] = useState<RobotPoseMap>({});
  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!MOCK_POSES || botNames.length === 0) return;

    const startTime = performance.now();

    const id = setInterval(() => {
      const t = (performance.now() - startTime) / 1000; // seconds elapsed

      const next: RobotPoseMap = {};
      botNames.forEach((name, idx) => {
        const { speed, phase, cx, cz } = getMockParams(name, idx);
        const angle = t * speed + phase;
        
        // Oval track parameters (inner lane)
        const ovalRadiusX = 1.7;
        const ovalRadiusZ = 0.7;
        
        const x = cx + ovalRadiusX * Math.cos(angle);
        const z = cz + ovalRadiusZ * Math.sin(angle);
        
        // Tangent for yaw
        const dx = -ovalRadiusX * speed * Math.sin(angle);
        const dz = ovalRadiusZ * speed * Math.cos(angle);
        const yaw = Math.atan2(dz, dx);
        
        next[name] = { x, z, yaw };
      });

      setPoses(next);
    }, MOCK_UPDATE_MS);

    return () => clearInterval(id);
  }, [botNames.join(',')]);

  useEffect(() => {
    if (MOCK_POSES || !isConnected || botNames.length === 0) return;

    botNames.forEach((name) => {
      if (subscribedRef.current.has(name)) return;
      subscribedRef.current.add(name);

      getMessage(
        `/${name}/pose`,
        'geometry_msgs/PoseStamped',
        (msg: any) => {
          const pos = msg?.pose?.position ?? msg?.position;
          const ori = msg?.pose?.orientation ?? msg?.orientation;
          if (!pos) return;

          const yaw = ori ? quaternionToYaw(ori) : 0;
          setPoses((prev) => ({
            ...prev,
            [name]: {
              x: pos.x ?? 0,
              z: pos.y ?? 0,
              yaw,
            },
          }));
        },
      );
    });
  }, [isConnected, botNames.join(',')]);

  return poses;
}

/** Extract yaw from a ROS quaternion (rotation around Z axis → Three.js Y). */
function quaternionToYaw(q: { x: number; y: number; z: number; w: number }): number {
  const { x, y, z, w } = q;
  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  return Math.atan2(sinyCosp, cosyCosp);
}
