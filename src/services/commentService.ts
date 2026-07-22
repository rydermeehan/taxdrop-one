import type { Comment } from '../types';
import { STORAGE_KEYS, getFromStorage, saveToStorage, generateId, getCurrentTimestamp } from './storage';

export function getComments(): Comment[] {
  return getFromStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
}

export function getCommentById(id: string): Comment | null {
  const comments = getComments();
  return comments.find(c => c.id === id) ?? null;
}

export function getCommentsByShot(shotId: string): Comment[] {
  return getComments()
    .filter(c => c.shotId === shotId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function getCommentThread(parentId: string): Comment[] {
  return getComments()
    .filter(c => c.parentId === parentId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function createComment(data: {
  shotId: string;
  authorId: string;
  text: string;
  parentId?: string;
}): Comment {
  const comments = getComments();

  const comment: Comment = {
    id: generateId(),
    shotId: data.shotId,
    authorId: data.authorId,
    text: data.text,
    timestamp: getCurrentTimestamp(),
    resolved: false,
    parentId: data.parentId,
  };

  comments.push(comment);
  saveToStorage(STORAGE_KEYS.COMMENTS, comments);
  return comment;
}

export function updateComment(id: string, updates: Partial<Comment>): Comment | null {
  const comments = getComments();
  const index = comments.findIndex(c => c.id === id);

  if (index === -1) return null;

  const updated: Comment = {
    ...comments[index],
    ...updates,
    id: comments[index].id,
    shotId: comments[index].shotId,
    authorId: comments[index].authorId,
    timestamp: comments[index].timestamp,
  };

  comments[index] = updated;
  saveToStorage(STORAGE_KEYS.COMMENTS, comments);
  return updated;
}

export function deleteComment(id: string): boolean {
  const comments = getComments();
  const commentToDelete = comments.find(c => c.id === id);
  if (!commentToDelete) return false;

  const replies = comments.filter(c => c.parentId === id);
  const idsToRemove = new Set([id, ...replies.map(r => r.id)]);

  const filtered = comments.filter(c => !idsToRemove.has(c.id));
  saveToStorage(STORAGE_KEYS.COMMENTS, filtered);
  return true;
}

export function resolveComment(id: string): Comment | null {
  return updateComment(id, { resolved: true });
}

export function unresolveComment(id: string): Comment | null {
  return updateComment(id, { resolved: false });
}

export function getUnresolvedCommentsByShot(shotId: string): Comment[] {
  return getCommentsByShot(shotId).filter(c => !c.resolved && !c.parentId);
}

export function deleteCommentsByShot(shotId: string): number {
  const comments = getComments();
  const filtered = comments.filter(c => c.shotId !== shotId);
  const deletedCount = comments.length - filtered.length;

  if (deletedCount > 0) {
    saveToStorage(STORAGE_KEYS.COMMENTS, filtered);
  }

  return deletedCount;
}
