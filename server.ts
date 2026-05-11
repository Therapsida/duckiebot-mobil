import bonjour from "bonjour";
import cors from "cors";
import express, { Request, Response } from "express";

const app = express();
app.use(cors());
app.use(express.json());

interface DiscoveredRobotInfo {
  name: string;
  ip: string;
  type: string;
  configuration: string;
}

const SCAN_TIMEOUT = 5000;

class DuckiebotMdnsScanner {
  private discoveredRobots: Map<string, DiscoveredRobotInfo> = new Map();
  private scanner: any = null;
  private bonjourInstance: any = null;

  async startScan(): Promise<DiscoveredRobotInfo[]> {
    return new Promise((resolve) => {
      this.discoveredRobots.clear();

      this.bonjourInstance = bonjour();

      this.scanner = this.bonjourInstance.find({
        type: "duckietown",
        protocol: "tcp",
      });

      this.scanner.on("up", (service: any) => {
        console.log("[mDNS] Service UP:", service.name);
        this.handleServiceResolved(service);
      });

      this.scanner.on("down", (service: any) => {
        console.log("[mDNS] Service DOWN:", service.name);
      });

      setTimeout(() => {
        this.stopScan();
        resolve(Array.from(this.discoveredRobots.values()));
      }, SCAN_TIMEOUT);
    });
  }

  private handleServiceResolved(service: any) {
    if (!service.name.startsWith("DT::ROBOT_CONFIGURATION")) {
      console.log(`[mDNS] Skipping non-robot service: ${service.name}`);
      return;
    }

    const robot = this.parseService(service);
    this.discoveredRobots.set(robot.name, robot);
    console.log(`Discovered robot: ${robot.name} at ${robot.ip}`);
  }

  private parseService(service: any): DiscoveredRobotInfo {
    const nameParts = service.name ? service.name.split("::") : [];
    const cleanName = nameParts.length >= 3 ? nameParts[2] : service.name;

    let ip = service.host || "unknown";
    if (service.addresses && Array.isArray(service.addresses)) {
      const ipv4 = service.addresses.find(
        (addr: string) => addr.includes(".") && !addr.includes(":"),
      );
      if (ipv4) ip = ipv4;
    }

    let configuration = "DB21M";
    let type = "Duckiebot";

    if (service.txt) {
      const rawKeys = Object.keys(service.txt);
      if (rawKeys.length > 0) {
        try {
          const jsonString = rawKeys[0];
          const parsedData = JSON.parse(jsonString);

          if (parsedData.configuration) {
            configuration = parsedData.configuration;
          }

          if (parsedData.type) {
            type = parsedData.type;
          }
        } catch (e) {
          console.warn("[mDNS] Failed to parse TXT record:", e);
        }
      }
    }

    return {
      name: cleanName,
      ip: ip,
      type: type,
      configuration: configuration,
    };
  }

  private stopScan() {
    if (this.scanner) {
      try {
        this.scanner.stop();
        console.log("[mDNS] Scanner stopped");
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
      this.scanner = null;
    }

    if (this.bonjourInstance) {
      try {
        this.bonjourInstance.destroy();
        console.log("[mDNS] Bonjour destroyed");
      } catch (e) {
        console.error("Error destroying bonjour:", e);
      }
      this.bonjourInstance = null;
    }
  }
}

const scanner = new DuckiebotMdnsScanner();

app.get("/api/scan", async (req: Request, res: Response) => {
  try {
    console.log("[API] Starting mDNS scan...");
    const robots = await scanner.startScan();
    console.log(`[API] Scan complete. Found ${robots.length} robots`);
    res.json({
      success: true,
      robots: robots,
      count: robots.length,
    });
  } catch (error) {
    console.error("[API] Scan error:", error);
    res.status(500).json({
      success: false,
      error: "Scan failed",
    });
  }
});

app.get("/api/debug/services", async (req: Request, res: Response) => {
  try {
    const bonjourInstance = bonjour();
    const allServices: any = [];

    const browser = bonjourInstance.find({ type: "duckietown" });
    browser.on("up", (service: any) => {
      console.log("[DEBUG] Service UP:", service.name);
      allServices.push(service);
    });

    setTimeout(() => {
      browser.stop();
      bonjourInstance.destroy();
      res.json({
        services: allServices,
        count: allServices.length,
      });
    }, 3000);
  } catch (error) {
    console.error("[DEBUG] Error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `Duckiebot mDNS scanner server running on http://localhost:${PORT}`,
  );
  console.log(`Scan endpoint: GET http://localhost:${PORT}/api/scan`);
});
