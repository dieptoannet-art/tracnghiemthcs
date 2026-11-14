export type CoreKnowledgeStatus = 'ready' | 'pending_upload';

export interface CoreKnowledgeLesson {
  id: string;
  grade: number; // 6, 7, 8, 9
  subjectCode: string; // 'Toan', 'Tin', 'KHTN'
  subjectName: string; // 'Toán', 'Tin học', 'Khoa học tự nhiên'
  bookSeries: string; // 'Kết nối tri thức với cuộc sống'
  volume: number; // 1, 2
  groupType: 'chapter' | 'topic' | 'intro' | 'activity' | 'review' | string;
  chapterNumber: number | null;
  chapterTitle: string;
  chapterLabel: string;
  lessonNumber: number | null;
  lessonTitle: string;
  lessonLabel: string;
  itemType: string;
  sortOrder: number;
  sourceFile: string;
  sourcePage: number;
  htmlFile: string;
  htmlUrl: string;
  status: CoreKnowledgeStatus;
  branch?: string | null;
  lessonCode?: string | null;
  previousHtmlUrl?: string | null;
  contentVersion?: string | null;
}

export interface CoreKnowledgeGroup {
  groupKey: string;
  volume: number;
  groupType: string;
  chapterNumber: number | null;
  chapterTitle: string;
  chapterLabel: string;
}

export interface CoreKnowledgeSelection {
  grade?: number;
  subjectCode?: string;
  volume?: number | '';
  groupKey?: string;
  lessonId?: string;
}
