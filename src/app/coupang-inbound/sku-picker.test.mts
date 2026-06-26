import assert from "node:assert/strict";

import { buildSkuPickerState, detectProductSeries } from "./sku-picker.ts";

const baseProducts = [
  {
    id: "1",
    sku: "HCB-584-163-WH",
    name: "蜂巢帘半遮光 58.4x163 白色",
    color: "白色",
    size: "58.4x163",
    memo: null
  },
  {
    id: "2",
    sku: "HCF-762-163-WH",
    name: "蜂巢帘全遮光 76.2x163 白色",
    color: "白色",
    size: "76.2x163",
    memo: null
  },
  {
    id: "3",
    sku: "4LK-350-130-WH",
    name: "4lockS 35x130 白色",
    color: "白色",
    size: "35x130",
    memo: null
  },
  {
    id: "4",
    sku: "4LK-700-130-GR",
    name: "4lockS 70x130 灰色",
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
  groupedState.groups.map((group) => [group.series, group.items.map((item) => item.sizeLabel)]),
  [
    ["half_blackout", ["58.4x163"]],
    ["full_blackout", ["76.2x163"]],
    ["4locks", ["35x130", "70x130"]]
  ]
);

const filteredState = buildSkuPickerState(baseProducts, "zh", "4locks", "70x130");
assert.equal(filteredState.groups.length, 1);
assert.equal(filteredState.groups[0]?.series, "4locks");
assert.deepEqual(filteredState.groups[0]?.items.map((item) => item.id), ["4"]);

console.log("sku-picker tests passed");
