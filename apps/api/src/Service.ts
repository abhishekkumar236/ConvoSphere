import type { Express } from "express";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import routes from "./modules/index.js";
import { RedisClient } from "helpers";
import { config } from "./config/index.js";

export class Service {
  private app: Express;
  private redis: RedisClient;
  constructor() {
    this.app = express();
    this.redis = RedisClient.initialize(config.REDIS_URL);
    this.registerListeners();
  }

  private registerListeners(): void {
    this.redis.on("connect", () => {
      console.log("Redis is connected");
    });
    this.redis.on("error", (error) => {
      console.log(`Error in redis connection: ${error}`);
    });

    this.redis.on("disconnect", () => {
      console.log("Redis is disconnected");
    });
  }
  private setupMiddlewares(): void {
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(express.json());
    this.app.use(cors());
  }

  private setupRoutes(): void {
    this.app.use("/api/v1", routes);
  }

  public init() {
    this.setupMiddlewares();
    this.setupRoutes();
    this.app.use(errorHandler);
    this.app.listen(9090, () => {
      console.log("Server is running on 9090");
    });
  }
}
