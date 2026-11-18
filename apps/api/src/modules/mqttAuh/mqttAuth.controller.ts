import type { MqttAuthService } from "./mqttAuth.service.js";
import type { Request, Response, NextFunction } from "express";

export class MqttAuthController {
  private mqttAuthService: MqttAuthService;
  constructor(mqttAuthService: MqttAuthService) {
    this.mqttAuthService = mqttAuthService;
  }

  userPath = async (req: Request, res: Response) => {
    try {
      console.log("userpath: ", req.body);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).send("allow");
    } catch (error) {
      res.type("text/plain");
      res.status(200).send("deny");
    }
  };

  resourcePath = async (req: Request, res: Response) => {
    try {
      console.log("resourcepath:", req.body);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).send("allow");
    } catch (error) {
      res.type("text/plain");
      res.status(200).send("deny");
    }
  };

  topicPath = async (req: Request, res: Response) => {
    try {
      console.log("topic path:", req.body);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).send("allow");
    } catch (error) {
      res.type("text/plain");
      res.status(200).send("deny");
    }
  };

  vhostPath = async (req: Request, res: Response) => {
    try {
      console.log("vhost:", req.body);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(200).send("allow");
    } catch (error) {
      res.type("text/plain");
      res.status(200).send("deny");
    }
  };
}
