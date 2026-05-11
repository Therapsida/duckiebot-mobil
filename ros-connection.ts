import * as ROSLIB from "roslib";

const ROS_BRIDGE_URL: string = "ws://192.168.43.64:9001";
const TOPIC_NAME: string = "/chatter";
const MESSAGE_TYPE: string = "std_msgs/String";

const ros = new ROSLIB.Ros({
  url: ROS_BRIDGE_URL,
});

ros.on("connection", () => {
  console.log(`✅ ROSBridge sunucusuna bağlanıldı: ${ROS_BRIDGE_URL}`);
});

ros.on("error", (error) => {
  console.error("❌ Bağlantı hatası:", error);
});

ros.on("close", () => {
  console.log("⚠️ ROSBridge bağlantısı kesildi.");
});
