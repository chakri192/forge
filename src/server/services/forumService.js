import { ForumModel, SuggestionModel } from '../models/Forum.js';
import { db } from '../db/database.js';
import { VoteModel, VOTE_TARGETS } from '../models/Vote.js';
import { TaskModel } from '../models/Task.js';
import { hasRole } from '../middleware/rbac.js';
import { ActivityService } from './activity.js';
import {
  FORUM_CATEGORIES,
  FORUM_TAGS,
  normaliseCategory,
  sanitiseTags
} from '../config/forum.js';
import { ProgressionService } from './progressionService.js';
import { NotificationService } from './notification.js';
import { publishAll } from './sse.js';
import { genId } from '../utils/genId.js';

const MODERATOR_ROLES = ['leader', 'teacher', 'admin'];

function canModerate(user) {
  return hasRole(user, MODERATOR_ROLES);
}

function canEdit(user, ownerId) {
  return ownerId === user.id || hasRole(user, ['admin']);
}

/**
 * Hacker-News style decay: score dominates early, age erodes it. Computed in
 * JS rather than SQL so the exponent stays readable and tunable.
 */
function rank(score, createdAt) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);
  return (score + 1) / (ageHours + 2) ** 1.5;
}

export const ForumService = {
  listThreads(user, { category, sort = 'hot', limit, offset } = {}) {
    const threads = ForumModel.listThreads({ category, limit, offset });
    const ids = threads.map((t) => t.id);
    const scores = VoteModel.scoresFor('FORUM_THREAD', ids);
    const mine = VoteModel.userVotesFor(user.id, 'FORUM_THREAD', ids);

    const decorated = threads.map((t) => ({
      ...t,
      score: scores[t.id] || 0,
      my_vote: mine[t.id] || 0
    }));

    if (sort === 'top') decorated.sort((a, b) => b.score - a.score);
    else if (sort === 'new') decorated.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else {
      decorated.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
        return rank(b.score, b.created_at) - rank(a.score, a.created_at);
      });
    }
    return decorated;
  },

  getThread(user, threadId, { countView = true } = {}) {
    const thread = ForumModel.getThread(threadId);
    if (!thread) throw { status: 404, message: 'Thread not found' };
    if (countView) ForumModel.incrementViews(threadId);

    const posts = ForumModel.listPosts(threadId);
    const postIds = posts.map((p) => p.id);
    const postScores = VoteModel.scoresFor('FORUM_POST', postIds);
    const myPostVotes = VoteModel.userVotesFor(user.id, 'FORUM_POST', postIds);

    return {
      thread: {
        ...thread,
        score: VoteModel.scoreFor('FORUM_THREAD', threadId),
        my_vote: VoteModel.userVotesFor(user.id, 'FORUM_THREAD', [threadId])[threadId] || 0
      },
      posts: posts.map((p) => ({
        ...p,
        score: postScores[p.id] || 0,
        my_vote: myPostVotes[p.id] || 0
      }))
    };
  },

  /** The fixed category and tag vocabulary, for a client building the filters. */
  taxonomy() {
    return { categories: FORUM_CATEGORIES, tags: FORUM_TAGS };
  },

  createThread(user, { title, category, content, tags }) {
    // Category is closed set now; anything unrecognised lands in General
    // rather than creating a category of one that nobody can browse to.
    const resolved = normaliseCategory(category);
    const thread = ForumModel.createThread({ title, category: resolved, authorId: user.id });
    this.setTags(thread.id, sanitiseTags(tags, canModerate(user)));
    if (content) {
      ForumModel.createPost({ threadId: thread.id, authorId: user.id, content });
    }
    ActivityService.logActivity({
      userId: user.id,
      action: 'FORUM_THREAD_CREATE',
      entityType: 'FORUM_THREAD',
      entityId: thread.id,
      details: { description: `${user.name} started "${title}"` }
    });
    ProgressionService.award({
      userId: user.id,
      amount: 15,
      sourceType: 'FORUM_THREAD',
      sourceId: thread.id,
      description: `Started a discussion: ${title}`
    });
    publishAll({ type: 'forum', action: 'thread_created', thread });
    return this.getThread(user, thread.id, { countView: false });
  },

  setTags(threadId, tags) {
    db.prepare(`UPDATE forum_threads SET tags = ? WHERE id = ?`).run(JSON.stringify(tags), threadId);
  },

  updateThread(user, threadId, fields) {
    const thread = ForumModel.getThread(threadId);
    if (!thread) throw { status: 404, message: 'Thread not found' };
    if (fields.category !== undefined) fields.category = normaliseCategory(fields.category);
    if (fields.tags !== undefined) {
      if (!canEdit(user, thread.author_id) && !canModerate(user)) {
        throw { status: 403, message: 'Only the author or a moderator can retag a thread' };
      }
      this.setTags(threadId, sanitiseTags(fields.tags, canModerate(user)));
      delete fields.tags;
    }
    // Pin and lock are moderation powers; title/category belong to the author.
    if ((fields.isPinned !== undefined || fields.isLocked !== undefined) && !canModerate(user)) {
      throw { status: 403, message: 'Only leaders, teachers, or admins can pin or lock threads' };
    }
    if ((fields.title !== undefined || fields.category !== undefined) && !canEdit(user, thread.author_id)) {
      throw { status: 403, message: 'Only the author or an admin can edit this thread' };
    }
    return ForumModel.updateThread(threadId, fields);
  },

  deleteThread(user, threadId) {
    const thread = ForumModel.getThread(threadId);
    if (!thread) throw { status: 404, message: 'Thread not found' };
    if (!canEdit(user, thread.author_id) && !canModerate(user)) {
      throw { status: 403, message: 'Not allowed to delete this thread' };
    }
    ForumModel.deleteThread(threadId);
    return { success: true, id: threadId };
  },

  reply(user, threadId, content) {
    const thread = ForumModel.getThread(threadId);
    if (!thread) throw { status: 404, message: 'Thread not found' };
    if (thread.is_locked && !canModerate(user)) {
      throw { status: 403, message: 'This thread is locked' };
    }

    const post = ForumModel.createPost({ threadId, authorId: user.id, content });
    ProgressionService.award({
      userId: user.id,
      amount: 5,
      sourceType: 'FORUM_POST',
      sourceId: post.id,
      description: 'Replied in the forum'
    });

    if (thread.author_id && thread.author_id !== user.id) {
      NotificationService.createNotification({
        userId: thread.author_id,
        title: `${user.name} replied to your thread`,
        message: content.slice(0, 120),
        type: 'MENTION',
        link: `#/forum/${threadId}`
      });
    }

    publishAll({ type: 'forum', action: 'post_created', threadId, post });
    return post;
  },

  editPost(user, postId, content) {
    const post = ForumModel.getPost(postId);
    if (!post) throw { status: 404, message: 'Post not found' };
    if (!canEdit(user, post.author_id)) {
      throw { status: 403, message: 'Only the author or an admin can edit this post' };
    }
    return ForumModel.updatePost(postId, content);
  },

  deletePost(user, postId) {
    const post = ForumModel.getPost(postId);
    if (!post) throw { status: 404, message: 'Post not found' };
    if (!canEdit(user, post.author_id) && !canModerate(user)) {
      throw { status: 403, message: 'Not allowed to delete this post' };
    }
    ForumModel.deletePost(postId);
    return { success: true, id: postId };
  },

  /** Accepting an answer is the thread author's call (or a moderator's). */
  acceptAnswer(user, threadId, postId) {
    const thread = ForumModel.getThread(threadId);
    if (!thread) throw { status: 404, message: 'Thread not found' };
    if (thread.author_id !== user.id && !canModerate(user)) {
      throw { status: 403, message: 'Only the thread author can accept an answer' };
    }
    const post = ForumModel.getPost(postId);
    if (!post || post.thread_id !== threadId) {
      throw { status: 404, message: 'Post not found in this thread' };
    }

    const accepted = ForumModel.markAnswer(threadId, postId);
    if (post.author_id && post.author_id !== user.id) {
      ProgressionService.award({
        userId: post.author_id,
        amount: 25,
        sourceType: 'ANSWER_ACCEPTED',
        sourceId: postId,
        description: `Your answer was accepted on "${thread.title}"`
      });
      NotificationService.createNotification({
        userId: post.author_id,
        title: 'Your answer was accepted',
        message: thread.title,
        type: 'REVIEW',
        link: `#/forum/${threadId}`
      });
    }
    return accepted;
  },

  vote(user, { targetType, targetId, value }) {
    if (!VOTE_TARGETS.includes(targetType)) {
      throw { status: 400, message: `targetType must be one of: ${VOTE_TARGETS.join(', ')}` };
    }
    if (![1, -1].includes(value)) {
      throw { status: 400, message: 'value must be 1 or -1' };
    }

    const result = VoteModel.cast({ userId: user.id, targetType, targetId, value });
    if (targetType === 'SUGGESTION') SuggestionModel.syncUpvotes(targetId, result.score);

    // The SSE transport already carries a 'vote' event type — live counts need
    // no extra plumbing.
    publishAll({ type: 'vote', targetType, targetId, score: result.score });
    return result;
  }
};

export const MarketplaceService = {
  list(user, { status } = {}) {
    const suggestions = SuggestionModel.list({ status });
    const ids = suggestions.map((s) => s.id);
    const scores = VoteModel.scoresFor('SUGGESTION', ids);
    const mine = VoteModel.userVotesFor(user.id, 'SUGGESTION', ids);
    return suggestions
      .map((s) => ({ ...s, score: scores[s.id] || 0, my_vote: mine[s.id] || 0 }))
      .sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
  },

  suggest(user, { title, description }) {
    const suggestion = SuggestionModel.create({ title, description, suggestedBy: user.id });
    ActivityService.logActivity({
      userId: user.id,
      action: 'SUGGESTION_CREATE',
      entityType: 'SUGGESTION',
      entityId: suggestion.id,
      details: { description: `${user.name} suggested "${title}"` }
    });
    publishAll({ type: 'vote', targetType: 'SUGGESTION', targetId: suggestion.id, score: 0 });
    return suggestion;
  },

  /**
   * Promote a community suggestion into a real task. One transaction so a
   * failure cannot leave a suggestion marked implemented with no task behind it.
   */
  promote(user, suggestionId, { total_points = 40, task_type = 'TEAM_TASK', difficulty = 'MEDIUM' } = {}) {
    const suggestion = SuggestionModel.getById(suggestionId);
    if (!suggestion) throw { status: 404, message: 'Suggestion not found' };
    if (suggestion.status === 'IMPLEMENTED') {
      throw { status: 409, message: 'This suggestion has already been promoted' };
    }

    const taskId = genId('tsk');
    TaskModel.create({
      id: taskId,
      title: suggestion.title,
      description: suggestion.description,
      status: 'active',
      difficulty,
      task_type,
      total_points,
      xp_reward: total_points * 2,
      // Must be 0: every task-list query filters on `is_marketplace = 0`, so a
      // promoted task flagged as marketplace would be invisible in Tasks.
      is_marketplace: 0,
      assigned_by: user.id
    });
    SuggestionModel.setStatus(suggestionId, 'IMPLEMENTED');

    if (suggestion.suggested_by) {
      ProgressionService.award({
        userId: suggestion.suggested_by,
        amount: 50,
        sourceType: 'SUGGESTION_PROMOTED',
        sourceId: suggestionId,
        description: `Your suggestion "${suggestion.title}" became a task`
      });
      NotificationService.createNotification({
        userId: suggestion.suggested_by,
        title: 'Your suggestion became a task',
        message: suggestion.title,
        type: 'ANNOUNCEMENT',
        link: '#/tasks'
      });
    }

    return { taskId, suggestion: SuggestionModel.getById(suggestionId) };
  },

  setStatus(user, suggestionId, status) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED'].includes(status)) {
      throw { status: 400, message: 'Invalid status' };
    }
    const suggestion = SuggestionModel.getById(suggestionId);
    if (!suggestion) throw { status: 404, message: 'Suggestion not found' };
    return SuggestionModel.setStatus(suggestionId, status);
  }
};
