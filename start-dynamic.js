const os = require("os");
const { spawn } = require("child_process");

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const currentIp = getLocalIpAddress();
console.log(`\n📡 Network Detected: http://${currentIp}:8081\n`);

const processEnv = { ...process.env, EXPO_PUBLIC_LOCAL_IP: currentIp };

const expo = spawn("npx", ["expo", "start", "--web", "--lan"], {
  env: processEnv,
  stdio: "inherit",
  shell: true,
});
