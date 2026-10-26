import type { Timestamp } from 'firebase/firestore';

export interface Topic {
  id: string;
  name: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ContentItem {
  id: string;
  topicId: string;
  text: string;
  sizeLevel: 1 | 2 | 3;
  baseWeight: number;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ContentForm {
  topicId: string;
  text: string;
  sizeLevel: '1' | '2' | '3';
  baseWeight: string;
  isActive: boolean;
}

export function validateContent(form: ContentForm, topics: Topic[]): string | null {
  if (!topics.some((topic) => topic.id === form.topicId)) return '請選擇有效的議題。';
  if (!form.text.trim()) return '文字內容不可空白。';
  if (form.text.trim().length > 120) return '文字內容最多 120 字。';
  if (!['1', '2', '3'].includes(form.sizeLevel)) return '字級僅能為 1、2、3。';
  if (form.baseWeight.trim() === '') return '請填寫人工權重。';
  const weight = Number(form.baseWeight);
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) return '人工權重必須介於 0 和 1。';
  return null;
}
