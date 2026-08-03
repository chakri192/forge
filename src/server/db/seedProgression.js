import { BadgeModel, AchievementModel } from '../models/Badge.js';

/**
 * Baseline badges and achievements. Idempotent (INSERT OR IGNORE on unique
 * names/ids), so it is safe to run on every boot and on an existing database.
 */
const BADGES = [
  { id: 'bdg_first_steps', name: 'First Steps', description: 'Submitted your first piece of work.', icon: 'footprint', category: 'MILESTONE', rarity: 'COMMON', xpBonus: 10 },
  { id: 'bdg_finisher', name: 'Finisher', description: 'Completed 5 approved tasks.', icon: 'task_alt', category: 'MILESTONE', rarity: 'UNCOMMON', xpBonus: 25 },
  { id: 'bdg_craftsman', name: 'Craftsman', description: 'Completed 25 approved tasks.', icon: 'construction', category: 'MILESTONE', rarity: 'RARE', xpBonus: 75 },
  { id: 'bdg_legend', name: 'Forge Legend', description: 'Completed 100 approved tasks.', icon: 'local_fire_department', category: 'MILESTONE', rarity: 'LEGENDARY', xpBonus: 250 },
  { id: 'bdg_consistent', name: 'Consistent', description: 'Maintained a 7-day activity streak.', icon: 'calendar_month', category: 'HABIT', rarity: 'UNCOMMON', xpBonus: 30 },
  { id: 'bdg_relentless', name: 'Relentless', description: 'Maintained a 30-day activity streak.', icon: 'bolt', category: 'HABIT', rarity: 'EPIC', xpBonus: 120 },
  { id: 'bdg_scholar', name: 'Scholar', description: 'Earned 1,000 XP.', icon: 'school', category: 'PROGRESSION', rarity: 'RARE', xpBonus: 50 },
  { id: 'bdg_communicator', name: 'Communicator', description: 'Sent 50 messages to the community.', icon: 'forum', category: 'COMMUNITY', rarity: 'COMMON', xpBonus: 15 },
  { id: 'bdg_helper', name: 'Helper', description: 'Wrote 10 forum posts.', icon: 'volunteer_activism', category: 'COMMUNITY', rarity: 'UNCOMMON', xpBonus: 25 },
  { id: 'bdg_respected', name: 'Respected', description: 'Received 25 upvotes from peers.', icon: 'thumb_up', category: 'COMMUNITY', rarity: 'EPIC', xpBonus: 100 },
  { id: 'bdg_teammate', name: 'Teammate', description: 'Joined your first squad.', icon: 'groups', category: 'COMMUNITY', rarity: 'COMMON', xpBonus: 10 },
  { id: 'bdg_regular', name: 'Regular', description: 'Logged 100 actions on the platform.', icon: 'history', category: 'HABIT', rarity: 'RARE', xpBonus: 60 }
];

const ACHIEVEMENTS = [
  { id: 'ach_first_steps', title: 'First Steps', description: 'Submit your first piece of work.', criteriaType: 'SUBMISSIONS_MADE', criteriaValue: 1, badgeId: 'bdg_first_steps', xpReward: 25 },
  { id: 'ach_finisher', title: 'Finisher', description: 'Get 5 submissions approved.', criteriaType: 'TASKS_COMPLETED', criteriaValue: 5, badgeId: 'bdg_finisher', xpReward: 75 },
  { id: 'ach_craftsman', title: 'Craftsman', description: 'Get 25 submissions approved.', criteriaType: 'TASKS_COMPLETED', criteriaValue: 25, badgeId: 'bdg_craftsman', xpReward: 200 },
  { id: 'ach_legend', title: 'Forge Legend', description: 'Get 100 submissions approved.', criteriaType: 'TASKS_COMPLETED', criteriaValue: 100, badgeId: 'bdg_legend', xpReward: 500 },
  { id: 'ach_consistent', title: 'Consistent', description: 'Reach a 7-day streak.', criteriaType: 'STREAK_DAYS', criteriaValue: 7, badgeId: 'bdg_consistent', xpReward: 100 },
  { id: 'ach_relentless', title: 'Relentless', description: 'Reach a 30-day streak.', criteriaType: 'STREAK_DAYS', criteriaValue: 30, badgeId: 'bdg_relentless', xpReward: 300 },
  { id: 'ach_scholar', title: 'Scholar', description: 'Earn 1,000 XP.', criteriaType: 'XP_EARNED', criteriaValue: 1000, badgeId: 'bdg_scholar', xpReward: 0 },
  { id: 'ach_communicator', title: 'Communicator', description: 'Send 50 messages.', criteriaType: 'MESSAGES_SENT', criteriaValue: 50, badgeId: 'bdg_communicator', xpReward: 50 },
  { id: 'ach_helper', title: 'Helper', description: 'Write 10 forum posts.', criteriaType: 'FORUM_POSTS', criteriaValue: 10, badgeId: 'bdg_helper', xpReward: 75 },
  { id: 'ach_respected', title: 'Respected', description: 'Receive 25 upvotes.', criteriaType: 'UPVOTES_RECEIVED', criteriaValue: 25, badgeId: 'bdg_respected', xpReward: 150 },
  { id: 'ach_teammate', title: 'Teammate', description: 'Join a squad.', criteriaType: 'TEAMS_JOINED', criteriaValue: 1, badgeId: 'bdg_teammate', xpReward: 25 },
  { id: 'ach_regular', title: 'Regular', description: 'Log 100 platform actions.', criteriaType: 'ACTIVITY_EVENTS', criteriaValue: 100, badgeId: 'bdg_regular', xpReward: 150 }
];

export function seedProgression() {
  for (const badge of BADGES) BadgeModel.create(badge);
  for (const achievement of ACHIEVEMENTS) AchievementModel.create(achievement);
  return { badges: BADGES.length, achievements: ACHIEVEMENTS.length };
}
