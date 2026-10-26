import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../examples/td-export-example.json', import.meta.url), 'utf8'));
if (data.schemaVersion !== 1) throw new Error('Unsupported schemaVersion');
if (typeof data.topicId !== 'string' || !data.topicId) throw new Error('Invalid topicId');
if (!Array.isArray(data.items)) throw new Error('items must be an array');
for (const item of data.items) {
  if (typeof item.id !== 'string' || !item.id) throw new Error('Invalid item ID');
  if (typeof item.text !== 'string' || !item.text) throw new Error('Invalid item text');
  if (![1, 2, 3].includes(item.sizeLevel)) throw new Error('Invalid sizeLevel');
  if (typeof item.baseWeight !== 'number' || item.baseWeight < 0 || item.baseWeight > 1) throw new Error('Invalid baseWeight');
}
console.log(`TD JSON 格式檢查通過：${data.topicId} / ${data.items.length} 筆`);
