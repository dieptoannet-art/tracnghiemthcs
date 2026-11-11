export type CoreKnowledgeStatus = 'ready' | 'pending_upload';

export interface CoreKnowledgeLesson {
  id: string;
  grade: number; // 6, 7
  subjectCode: string; // 'Toan', 'Tin'
  subjectName: string; // 'Toán', 'Tin học'
  bookSeries: string; // 'Kết nối tri thức với cuộc sống'
  volume: number; // 1, 2
  groupType: 'chapter' | 'topic' | 'activity' | 'review' | string;
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
  groupKey?: string;
  lessonId?: string;
}
