import { MqttTokenService } from "helpers";
import { config } from "../../config/index.js";

/** One instance for the api: signs MQTT session tokens (handshake). Room tokens: room-service. */
export const mqttTokenService = new MqttTokenService(
  config.MQTT_TOKEN_SECRET,
  config.MQTT_TOKEN_EXPIRY,
);
