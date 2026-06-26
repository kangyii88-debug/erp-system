import assert from "node:assert/strict";

import { buildSkuPickerState, detectProductSeries } from "./sku-picker.ts";

const baseProducts = [
  {
    id: "1",
    sku: "BZG-CP-584-163-WH",
    name: "蜂巢帘半遮光 58.4x163 白色",
    color: "白色",
    size: "58.4x163",
    memo: null
  },
  {
    id: "2",
    sku: "BLD-CP-584-163-WH",
    name: "蜂巢帘全遮光 58.4x163 白色",
    color: "白色",
    size: "58.4x163",
    memo: null
  },
  {
    id: "3",
    sku: "4LK-350-130-WH",
    name: "4locks 35x130 白色",
    color: "白色",
    size: "35x130",
    memo: null
  },
  {
    id: "4",
    sku: "4LK-700-130-GR",
    name: "4locks 70x130 灰色",
    color: "灰色",
    size: "70x130",
    memo: null
  }
];

assert.equal(detectProductSeries(baseProducts[0]), "half_blackout");
assert.equal(detectProductSeries(baseProducts[1]), "full_blackout");
assert.equal(detectProductSeries(baseProducts[2]), "4locks");

const groupedState = buildSkuPickerState(baseProducts, "zh", "all", "");
assert.deepEqual(
  groupedState.groups.map((group) => [group.series, group.items.map((item) => item.sku)]),
  [
    ["half_blackout", ["BZG-CP-584-163-WH"]],
    ["full_blackout", ["BLD-CP-584-163-WH"]],
    ["4locks", ["4LK-350-130-WH", "4LK-700-130-GR"]]
  ]
);

const filteredState = buildSkuPickerState(baseProducts, "zh", "full_blackout", "BLD");
assert.equal(filteredState.groups.length, 1);
assert.equal(filteredState.groups[0]?.series, "full_blackout");
assert.deepEqual(filteredState.groups[0]?.items.map((item) => item.id), ["2"]);

console.log("sku-picker tests passed");
