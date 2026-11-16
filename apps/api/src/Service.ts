import type { Express } from "express";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import routes from "./modules/index.js";

export class Service {
  private app: Express;
  constructor() {
    this.app = express();
  }

  private setupMiddlewares(): void {
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
