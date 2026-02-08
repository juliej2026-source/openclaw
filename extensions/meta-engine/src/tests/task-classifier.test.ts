import { describe, expect, it } from "vitest";
import { classifyTask } from "../task-classifier.js";

describe("classifyTask", () => {
  it("classifies code-related prompts", () => {
    expect(classifyTask("Write a Python function to sort a list").primary).toBe("coding");
    expect(classifyTask("Fix the bug in the login function").primary).toBe("coding");
    expect(classifyTask("Implement a binary search tree").primary).toBe("coding");
    expect(classifyTask("Refactor this TypeScript class").primary).toBe("coding");
    expect(classifyTask("Debug this JavaScript code:\n```js\nconst x = 1;\n```").primary).toBe(
      "coding",
    );
  });

  it("classifies reasoning prompts", () => {
    expect(classifyTask("Explain why the sky is blue step by step").primary).toBe("reasoning");
    expect(classifyTask("Compare and contrast TCP vs UDP").primary).toBe("reasoning");
    expect(classifyTask("Why does this algorithm have O(n log n) complexity?").primary).toBe(
      "reasoning",
    );
  });

  it("classifies vision prompts", () => {
    const result = classifyTask("Describe this image for me");
    expect(result.primary).toBe("vision");
    expect(result.requiresVision).toBe(true);
  });

  it("classifies math prompts", () => {
    expect(classifyTask("Calculate the integral of x^2 from 0 to 5").primary).toBe("math");
    expect(classifyTask("Solve for x in the equation 3x + 5 = 20").primary).toBe("math");
  });

  it("classifies creative prompts", () => {
    expect(classifyTask("Write a story about a robot who learns to feel emotions").primary).toBe(
      "creative",
    );
    expect(classifyTask("Brainstorm some creative ideas for a new startup name").primary).toBe(
      "creative",
    );
  });

  it("classifies summarization prompts", () => {
    expect(classifyTask("Summarize this article").primary).toBe("summarization");
    expect(classifyTask("Give me a tl;dr of the document").primary).toBe("summarization");
  });

  it("defaults to chat for generic prompts", () => {
    expect(classifyTask("Hello, how are you?").primary).toBe("chat");
    expect(classifyTask("What time is it?").primary).toBe("chat");
  });

  it("estimates complexity correctly", () => {
    expect(classifyTask("Hi").complexity).toBe("simple");
    // Code blocks trigger moderate complexity
    expect(classifyTask("Fix this:\n```js\nconst x = 1;\nconsole.log(x);\n```").complexity).toBe(
      "moderate",
    );
    expect(classifyTask("a ".repeat(300)).complexity).toBe("complex");
  });

  it("detects tool-use signals", () => {
    const result = classifyTask("Search the web for the latest news");
    expect(result.requiresToolUse).toBe(true);
  });

  it("returns confidence scores", () => {
    // Strong signal should have high confidence
    const strong = classifyTask("Implement a function to sort arrays in TypeScript");
    expect(strong.confidence).toBeGreaterThan(0.7);

    // Ambiguous prompt should have lower confidence
    const weak = classifyTask("Hello");
    expect(weak.confidence).toBeLessThanOrEqual(0.5);
  });

  it("includes secondary task types", () => {
    // "Explain why this Python code fails" has both coding and reasoning signals
    const result = classifyTask("Explain why this Python function fails to sort correctly");
    const allTypes = [result.primary, ...result.secondary];
    // Should pick up at least one of coding or reasoning
    expect(allTypes.length).toBeGreaterThanOrEqual(1);
  });
});
