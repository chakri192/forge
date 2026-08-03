import express from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { CalendarModel, EVENT_TYPES } from '../models/Calendar.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { hasRole } from '../middleware/rbac.js';

const router = express.Router();

const eventSchema = {
  body: z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    start_time: z.string().min(1, 'start_time is required'),
    end_time: z.string().min(1, 'end_time is required'),
    location: z.string().trim().max(200).nullable().optional(),
    event_type: z.enum(EVENT_TYPES).optional(),
    team_id: z.string().nullable().optional()
  })
};

// -------------------------------------------------------------- Calendar

router.get('/calendar', requireAuth, validate({}), (req, res, next) => {
  try {
    const { from, to } = req.query;
    const events = CalendarModel.listVisible(req.user.id, { from, to }).map((e) => ({
      ...e,
      source: 'event'
    }));
    const deadlines = CalendarModel.taskDeadlinesFor(req.user.id, { from, to });
    const merged = [...events, ...deadlines].sort((a, b) =>
      String(a.start_time).localeCompare(String(b.start_time))
    );
    res.json({ events: merged });
  } catch (err) {
    next(err);
  }
});

router.post('/calendar', requirePermission('TASK_CREATE'), validate(eventSchema), (req, res, next) => {
  try {
    if (new Date(req.body.end_time) < new Date(req.body.start_time)) {
      throw { status: 400, message: 'end_time cannot be before start_time' };
    }
    const event = CalendarModel.create({
      title: req.body.title,
      description: req.body.description ?? null,
      startTime: req.body.start_time,
      endTime: req.body.end_time,
      location: req.body.location ?? null,
      eventType: req.body.event_type || 'EVENT',
      createdBy: req.user.id,
      teamId: req.body.team_id || null
    });
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

router.patch('/calendar/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    const event = CalendarModel.getById(req.params.id);
    if (!event) throw { status: 404, message: 'Event not found' };
    if (event.created_by !== req.user.id && !hasRole(req.user, ['teacher', 'admin'])) {
      throw { status: 403, message: 'Only the organiser or a teacher can edit this event' };
    }
    res.json({
      event: CalendarModel.update(req.params.id, {
        title: req.body.title,
        description: req.body.description,
        startTime: req.body.start_time,
        endTime: req.body.end_time,
        location: req.body.location,
        eventType: req.body.event_type,
        teamId: req.body.team_id
      })
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/calendar/:id', requireAuth, validate({}), (req, res, next) => {
  try {
    const event = CalendarModel.getById(req.params.id);
    if (!event) throw { status: 404, message: 'Event not found' };
    if (event.created_by !== req.user.id && !hasRole(req.user, ['teacher', 'admin'])) {
      throw { status: 403, message: 'Only the organiser or a teacher can delete this event' };
    }
    CalendarModel.delete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------- Analytics

router.get('/analytics', requirePermission('LEADER_ROTATE'), validate({}), (req, res, next) => {
  try {
    res.json(AnalyticsService.full());
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/at-risk', requirePermission('LEADER_ROTATE'), validate({}), (req, res, next) => {
  try {
    res.json({ members: AnalyticsService.atRisk() });
  } catch (err) {
    next(err);
  }
});

export default router;
