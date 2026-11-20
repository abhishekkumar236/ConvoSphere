import { z } from "zod";

/**
 * What the api puts inside an access token, checked again on every request.
 * jwt adds iat/exp; zod drops them from the result.
 */
export const AccessTokenPayloadSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
});

export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;
