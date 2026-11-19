import { Service } from "./Service.js";

const service = new Service();
service.init().catch((error: unknown) => {
  console.error("[SERVICE] Failed to start:", error);
  process.exit(1);
});
