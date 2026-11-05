import { apiClient } from './axios.config';

export interface Person { id: number; name: string }
export interface Review {
  id: number
  rating: number
  text: string
  author_reply: string
  created_at: string
  updated_at: string
  reviewer: Person
  is_mine: boolean
  is_hidden: boolean
}
export interface ReviewPage { count: number; distribution: Record<string, number>; results: Review[] }
export interface Comment {
  id: number
  body: string
  created_at: string
  edited_at: string | null
  author: Person
  is_course_author: boolean
  can_edit: boolean
  can_delete: boolean
  replies: Comment[]
}
export interface CommentPage { count: number; results: Comment[] }
export type ReportTarget = 'course' | 'review' | 'comment'
export type ReportReason = 'spam' | 'abuse' | 'inappropriate' | 'copyright' | 'misleading' | 'other'
export interface Reported {
  target_type: ReportTarget
  target_id: number
  course_id: number | null
  preview: string
  is_hidden: boolean
  reports: number
  reasons: ReportReason[]
  details: string[]
  first_reported_at: string
}

export const communityApi = {
  reviews: async (courseId: number, offset = 0): Promise<ReviewPage> => {
    const { data } = await apiClient.get<ReviewPage>(`/courses/${courseId}/reviews/`, { params: { offset, limit: 10 } });
    return data;
  },

  myReview: async (courseId: number): Promise<Review> => {
    const { data } = await apiClient.get<Review>(`/courses/${courseId}/reviews/mine/`);
    return data;
  },

  saveReview: async (courseId: number, rating: number, text: string): Promise<Review> => {
    const { data } = await apiClient.put<Review>(`/courses/${courseId}/reviews/`, { rating, text });
    return data;
  },

  deleteReview: async (courseId: number): Promise<void> => {
    await apiClient.delete(`/courses/${courseId}/reviews/`);
  },

  reply: async (reviewId: number, text: string): Promise<Review> => {
    const { data } = await apiClient.put<Review>(`/reviews/${reviewId}/reply/`, { text });
    return data;
  },

  comments: async (courseId: number, lessonId: number, offset = 0): Promise<CommentPage> => {
    const { data } = await apiClient.get<CommentPage>(`/courses/${courseId}/lessons/${lessonId}/comments/`, { params: { offset, limit: 20 } });
    return data;
  },

  addComment: async (courseId: number, lessonId: number, body: string, parentId?: number): Promise<Comment> => {
    const { data } = await apiClient.post<Comment>(`/courses/${courseId}/lessons/${lessonId}/comments/`, { body, parent_id: parentId ?? null });
    return data;
  },

  editComment: async (commentId: number, body: string): Promise<Comment> => {
    const { data } = await apiClient.patch<Comment>(`/comments/${commentId}/`, { body });
    return data;
  },

  deleteComment: async (commentId: number): Promise<void> => {
    await apiClient.delete(`/comments/${commentId}/`);
  },

  report: async (target_type: ReportTarget, target_id: number, reason: ReportReason, details: string): Promise<void> => {
    await apiClient.post('/reports/', { target_type, target_id, reason, details });
  },

  openReports: async (): Promise<Reported[]> => {
    const { data } = await apiClient.get<Reported[]>('/moderation/reports/');
    return data;
  },

  decide: async (target: ReportTarget, id: number, action: 'keep' | 'remove'): Promise<void> => {
    await apiClient.post(`/moderation/${target}/${id}/`, { action });
  },
};
