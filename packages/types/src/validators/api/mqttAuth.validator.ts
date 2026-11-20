import { z } from "zod";

export const UserPathSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  client_id: z.string().min(1, "Client Id is required"),
});

export const ResourcePathSchema = z.object({
  username: z.string(),
  vhost: z.string(),
  resource: z.string(),
  name: z.string(),
  permission: z.string(),
  tags: z.string(),
  client_id: z.string(),
});

export const TopicPathSchema = z.object({
  username: z.string(),
  vhost: z.string(),
  resource: z.string(),
  name: z.string(),
  permission: z.string(),
  tags: z.string(),
  routing_key: z.string(),
});

export const VhostPathSchema = z.object({
  username: z.string(),
  vhost: z.string(),
  ip: z.string(),
  client_id: z.string(),
});

export type UserPathRequest = z.infer<typeof UserPathSchema>;
export type ResourcePathRequest = z.infer<typeof ResourcePathSchema>;
export type TopicPathRequest = z.infer<typeof TopicPathSchema>;
export type VhostPathSchema = z.infer<typeof VhostPathSchema>;
