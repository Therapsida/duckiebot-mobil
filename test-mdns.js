// Alt seviye multicast-dns paketini kullanıyoruz (bonjour da arka planda bunu kullanır)
const mdns = require("multicast-dns")({
  interface: "10.42.0.1", // Kendi hotspot IP'n
});

console.log("🦆 mDNS dinleniyor (IP: 10.42.0.1)...");

mdns.on("response", function (response) {
  const packetStr = JSON.stringify(response);
  // Gelen paketin içinde "duckie" veya "DT::" geçiyorsa ekrana bas
  if (
    packetStr.toLowerCase().includes("duckie") ||
    packetStr.toLowerCase().includes("dt::")
  ) {
    console.log("\n[!] DUCKIEBOT PAKETİ YAKALANDI!");
    console.log(JSON.stringify(response, null, 2));
  }
});

// Ağdaki cihazlara "Kimler var?" diye sor
mdns.query({
  questions: [
    {
      name: "_duckietown._tcp.local",
      type: "PTR",
    },
  ],
});
