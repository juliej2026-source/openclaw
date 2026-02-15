// ---------------------------------------------------------------------------
// EMWCP — Inter-Agent Message Validator
// AJV-based runtime validation against the emwcp-agent-message.v1 schema
// ---------------------------------------------------------------------------

import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { InterAgentMessage } from "../types.js";
import { INTER_AGENT_MESSAGE_SCHEMA } from "./inter-agent-message.js";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);

const validate = ajv.compile(INTER_AGENT_MESSAGE_SCHEMA);

/**
 * Validate an unknown object against the inter-agent message schema.
 * Returns { valid: true, message } on success, or { valid: false, errors } on failure.
 */
export function validateInterAgentMessage(msg: unknown): {
  valid: boolean;
  errors: string[];
  message?: InterAgentMessage;
} {
  const valid = validate(msg);
  if (valid) {
    return { valid: true, errors: [], message: msg as InterAgentMessage };
  }
  return {
    valid: false,
    errors: (validate.errors ?? []).map((e) => `${e.instancePath}: ${e.message}`),
  };
}
