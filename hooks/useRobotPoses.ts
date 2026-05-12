import { useMultiRos } from "@/context/RosContext";
import { useEffect, useRef, useState } from "react";

export interface RobotPose {
  x: number;
  z: number;
  /** Yaw in radians (rotation around Y axis in Three.js coords) */
  yaw: number;
}

export type RobotPoseMap = Record<string, RobotPose>;

/**
 * Subscribes to pose topics for each bot and returns real ROS data only.
 * Each bot has an independent ROS connection that can be opened/closed separately.
 *
 * ROS coordinate mapping:
 *   pose.position.x  → Three.js X
 *   pose.position.y  → Three.js Z  (ROS Y is forward; we map it to depth)
 *   pose.orientation → quaternion  → yaw
 */
export function useRobotPoses(botNames: string[]): RobotPoseMap {
  const { subscribeToBot } = useMultiRos();
  const [poses, setPoses] = useState<RobotPoseMap>({});
  const subscribedRef = useRef<Set<string>>(new Set());

  // Subscribe to real ROS data for each bot
  useEffect(() => {
    if (botNames.length === 0) return;

    botNames.forEach((name) => {
      if (subscribedRef.current.has(name)) return;
      subscribedRef.current.add(name);

      console.log(`[${name}] Subscribing to pose topic`);

      subscribeToBot(
        name,
        `/${name}/map_odom_corrector_node/robot_pose`,
        "geometry_msgs/Pose2D",
        (msg: any) => {
          // 1. Check if the message contains the poses array and it's not empty
          if (!msg) return;

          const yaw = msg?.theta;

          setPoses((prev) => ({
            ...prev,
            [name]: {
              x: msg?.y * (10 / 6),
              z: msg?.x * (10 / 6),
              yaw: yaw - Math.PI / 2,
            },
          }));
        },
      );
    });

    return () => {
      subscribedRef.current.clear();
    };
  }, [botNames.join(",")]);

  return poses;
}
