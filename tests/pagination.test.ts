import { expect, test } from "vitest";
import { collect, optionValue, quantities } from "../lib/shopify/pagination";
test("collects beyond the first page", async () => {
  const cursors: (string | null)[] = [];
  const result = await collect(async (after) => {
    cursors.push(after);
    return {
      nodes: after ? [3] : [1, 2],
      pageInfo: { hasNextPage: !after, endCursor: "next" },
    };
  });
  expect(result).toEqual([1, 2, 3]);
  expect(cursors).toEqual([null, "next"]);
});
test("rejects repeating pagination instead of hanging", async () => {
  await expect(
    collect(async () => ({
      nodes: [],
      pageInfo: { hasNextPage: true, endCursor: "same" },
    })),
  ).rejects.toThrow("Pagination");
});
test("maps named French options independent of option order", () => {
  expect(
    optionValue(
      [
        { name: "Couleur", value: "Bleu" },
        { name: " Taille ", value: "XL" },
      ],
      ["size", "taille"],
    ),
  ).toBe("XL");
});
test("does not turn missing stock into a false zero", () => {
  expect(() => quantities([{ name: "available", quantity: 0 }])).toThrow(
    "on_hand",
  );
  expect(
    quantities([
      { name: "on_hand", quantity: 10 },
      { name: "available", quantity: -2 },
    ]),
  ).toEqual({ onHandQty: 10, availableQty: -2 });
});
