import { describe, it, expect } from "vitest";
import { jaccardSimilarity, fluencyScore, accuracyScore, overallScore } from "../eval/metrics.js";

describe("jaccardSimilarity", () => {
  it("returns 1 for identical texts", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
  });

  it("returns 0 for completely different texts", () => {
    expect(jaccardSimilarity("hello world", "foo bar baz")).toBe(0);
  });

  it("returns partial overlap", () => {
    const score = jaccardSimilarity("the quick brown fox", "the slow brown dog");
    // "the" and "brown" overlap → 2 / 6 = 0.333
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(0.5);
  });

  it("handles empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1);
    expect(jaccardSimilarity("hello", "")).toBe(0);
    expect(jaccardSimilarity("", "world")).toBe(0);
  });

  it("is case insensitive", () => {
    expect(jaccardSimilarity("Hello World", "hello world")).toBe(1);
  });
});

describe("fluencyScore", () => {
  it("returns 0 for empty text", () => {
    expect(fluencyScore("")).toBe(0);
  });

  it("returns higher score for well-structured text", () => {
    const good =
      "This is a well-written sentence. It has proper structure and reasonable length. The content flows naturally.";
    const bad = "word word word";

    expect(fluencyScore(good)).toBeGreaterThan(fluencyScore(bad));
  });

  it("returns score between 0 and 1", () => {
    const score = fluencyScore("A reasonable response with some content.");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("accuracyScore", () => {
  it("returns high score for similar responses", () => {
    const response = "Python is a programming language used for web development and data science.";
    const reference =
      "Python is a programming language widely used in data science and web development.";

    const score = accuracyScore(response, reference);
    expect(score).toBeGreaterThan(0.5);
  });

  it("returns low score for dissimilar responses", () => {
    const score = accuracyScore("The sky is blue.", "Python is a programming language.");
    expect(score).toBeLessThan(0.2);
  });

  it("penalizes very different lengths", () => {
    const reference = "A detailed explanation of how arrays work in JavaScript including sorting.";
    const tooShort = "Arrays.";
    const reasonable =
      "Arrays in JavaScript are ordered collections that support sorting operations.";

    expect(accuracyScore(reasonable, reference)).toBeGreaterThan(
      accuracyScore(tooShort, reference),
    );
  });
});

describe("overallScore", () => {
  it("combines accuracy and fluency", () => {
    const score = overallScore({ accuracy: 0.8, fluency: 0.7 });
    // 0.8 * 0.6 + 0.7 * 0.4 = 0.48 + 0.28 = 0.76
    expect(score).toBeCloseTo(0.76, 2);
  });

  it("incorporates task-specific scores", () => {
    const score = overallScore({
      accuracy: 0.8,
      fluency: 0.7,
      taskScores: { coding: 0.9, reasoning: 0.6 },
    });
    // taskAvg = 0.75, 0.8*0.4 + 0.7*0.2 + 0.75*0.4 = 0.32 + 0.14 + 0.30 = 0.76
    expect(score).toBeCloseTo(0.76, 2);
  });

  it("returns 0 when all scores are 0", () => {
    expect(overallScore({ accuracy: 0, fluency: 0 })).toBe(0);
  });
});
