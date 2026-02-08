import { describe, it, expect } from "vitest";
import type { TrainingPair } from "../types.js";
import { validateDataset } from "../dataset/validator.js";

function makePair(userContent: string, assistantContent: string): TrainingPair {
  return {
    conversations: [
      { role: "user", content: userContent },
      { role: "assistant", content: assistantContent },
    ],
    source: { sessionId: "test", timestamp: new Date().toISOString() },
  };
}

describe("validateDataset", () => {
  it("passes valid pairs through", () => {
    const pairs = [
      makePair("How do I sort an array?", "You can use Array.sort() in JavaScript."),
      makePair("What is Python?", "Python is a high-level programming language."),
    ];

    const result = validateDataset(pairs);
    expect(result.valid.length).toBe(2);
    expect(result.removed).toBe(0);
  });

  it("rejects pairs with missing roles", () => {
    const pair: TrainingPair = {
      conversations: [{ role: "user", content: "Hello" }],
      source: { sessionId: "test", timestamp: new Date().toISOString() },
    };

    const result = validateDataset([pair]);
    expect(result.valid.length).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.reasons["missing_role"]).toBe(1);
  });

  it("rejects pairs with too-short prompts", () => {
    const pair = makePair("Hi", "This is a detailed response about something.");
    const result = validateDataset([pair]);
    expect(result.valid.length).toBe(0);
    expect(result.reasons["prompt_too_short"]).toBe(1);
  });

  it("rejects pairs with too-short responses", () => {
    const pair = makePair("How do I sort an array in JavaScript?", "sort()");
    const result = validateDataset([pair]);
    expect(result.valid.length).toBe(0);
    expect(result.reasons["response_too_short"]).toBe(1);
  });

  it("rejects error responses", () => {
    const pair = makePair(
      "Help me write code",
      "I'm sorry, I can't help with that request right now.",
    );
    const result = validateDataset([pair]);
    expect(result.valid.length).toBe(0);
    expect(result.reasons["error_response"]).toBe(1);
  });

  it("deduplicates identical pairs", () => {
    const pair1 = makePair(
      "What is React?",
      "React is a JavaScript library for building user interfaces.",
    );
    const pair2 = makePair(
      "What is React?",
      "React is a JavaScript library for building user interfaces.",
    );

    const result = validateDataset([pair1, pair2]);
    expect(result.valid.length).toBe(1);
    expect(result.reasons["duplicate"]).toBe(1);
  });

  it("returns correct removal reason counts", () => {
    const pairs: TrainingPair[] = [
      makePair("Good question here", "A valid response that is long enough."),
      makePair("Hi", "Valid but short prompt response that is long enough"),
      makePair("Another question", "short"),
      makePair("Help me", "I'm sorry, I can't fulfill this request."),
    ];

    const result = validateDataset(pairs);
    expect(result.valid.length).toBe(1);
    expect(result.removed).toBe(3);
  });
});
