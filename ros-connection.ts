import * as ROSLIB from 'roslib';

// --- AYARLAR (HARD CODED) ---
const ROS_BRIDGE_URL: string = 'ws://192.168.43.64:9001'; // ROSBridge WebSocket adresi
const TOPIC_NAME: string = '/chatter';                // Dinlenecek/Yazılacak topic
const MESSAGE_TYPE: string = 'std_msgs/String';       // Mesaj tipi

// 1. ROS Bağlantı Nesnesini Oluştur
const ros = new ROSLIB.Ros({
  url: ROS_BRIDGE_URL,
});

// --- BAĞLANTI DURUMU YÖNETİMİ ---

ros.on('connection', () => {
  console.log(`✅ ROSBridge sunucusuna bağlanıldı: ${ROS_BRIDGE_URL}`);
  
  // Bağlantı kurulduktan sonra işlemleri başlat

});

ros.on('error', (error) => {
  console.error('❌ Bağlantı hatası:', error);
});

ros.on('close', () => {
  console.log('⚠️ ROSBridge bağlantısı kesildi.');
});

// --- FONKSİYONLAR ---


// Manuel bağlantı başlatma (Eğer yapıcı metodda url verilmezse connect() çağrılır,
// ama biz yukarıda url verdik, bu yüzden otomatik dener. Yine de manuel tetikleme gerekirse:)
// ros.connect(ROS_BRIDGE_URL);