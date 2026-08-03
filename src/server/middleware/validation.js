import { z } from 'zod';

export function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  // Remove script tags and HTML tags to prevent XSS
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function sanitizeData(data) {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (data && typeof data === 'object' && !(data instanceof Date)) {
    const sanitized = {};
    for (const [key, val] of Object.entries(data)) {
      sanitized[key] = sanitizeData(val);
    }
    return sanitized;
  }
  return data;
}

export function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeData(req.body);
      }
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeData(req.query);
      }
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeData(req.params);
      }

      if (schemas.body && req.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query && req.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params && req.params) {
        req.params = schemas.params.parse(req.params);
      }

      next();
    } catch (err) {
      if (err.name === 'ZodError' || err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        const errorMessages = issues.map(e => `${e.path ? e.path.join('.') + ': ' : ''}${e.message}`).join(', ');
        return res.status(400).json({
          success: false,
          error: `Validation error: ${errorMessages || err.message}`,
          details: issues
        });
      }
      next(err);
    }
  };
}

// Pre-defined Zod Schemas for System Routes

export const authSchemas = {
  login: {
    body: z.object({
      identifier: z.string().trim().min(1, 'Identifier is required'),
      password: z.string().min(1, 'Password is required')
    })
  },
  signup: {
    body: z.object({
      name: z.string().trim().min(1, 'Name is required'),
      username: z.string().trim().min(2, 'Username must be at least 2 characters'),
      email: z.string().trim().email('Invalid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      role: z.enum(['member', 'leader', 'teacher', 'admin', 'DEV_STEALTH']).optional(),
      tag: z.string().optional()
    })
  },
  changePassword: {
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(6, 'New password must be at least 6 characters')
    })
  }
};

export const userSchemas = {
  updateRole: {
    body: z.object({
      role: z.enum(['member', 'leader', 'teacher', 'admin', 'DEV_STEALTH'], {
        required_error: 'Invalid role',
        invalid_type_error: 'Invalid role',
        errorMap: () => ({ message: 'Invalid role' })
      })
    })
  },
  updateProfile: {
    body: z.object({
      name: z.string().trim().optional(),
      tag: z.string().trim().optional(),
      bio: z.string().trim().optional(),
      skills: z.string().trim().optional(),
      github_url: z.string().trim().optional(),
      portfolio_url: z.string().trim().optional()
    })
  }
};

export const taskSchemas = {
  create: {
    body: z.object({
      title: z.string().trim().min(1, 'Title is required'),
      description: z.string().trim().min(1, 'Description is required'),
      instructions: z.string().optional(),
      resources: z.string().optional(),
      total_points: z.number().int().optional(),
      xp_reward: z.number().int().optional(),
      badge_reward: z.string().optional(),
      difficulty: z.string().optional(),
      task_type: z.string().optional(),
      mode: z.string().optional(),
      is_marketplace: z.boolean().optional(),
      assigned_team_id: z.string().nullable().optional(),
      assigned_user_id: z.string().nullable().optional(),
      proof_requirements: z.string().optional(),
      deadline: z.string().optional(),
      status: z.string().optional()
    })
  },
  update: {
    body: z.object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).optional(),
      instructions: z.string().optional(),
      resources: z.string().optional(),
      total_points: z.number().int().optional(),
      xp_reward: z.number().int().optional(),
      badge_reward: z.string().optional(),
      difficulty: z.string().optional(),
      task_type: z.string().optional(),
      mode: z.string().optional(),
      is_marketplace: z.boolean().optional(),
      assigned_team_id: z.string().nullable().optional(),
      assigned_user_id: z.string().nullable().optional(),
      proof_requirements: z.string().optional(),
      deadline: z.string().optional(),
      status: z.string().optional()
    })
  },
  updateStatus: {
    body: z.object({
      status: z.string({ required_error: 'Status is required' }).trim().min(1, 'Status is required')
    })
  },
  suggest: {
    body: z.object({
      title: z.string({ required_error: 'Title and description required', invalid_type_error: 'Title and description required' }).trim().min(1, 'Title and description required'),
      description: z.string({ required_error: 'Title and description required', invalid_type_error: 'Title and description required' }).trim().min(1, 'Title and description required'),
      total_points: z.number().int().positive().optional(),
      task_type: z.enum(['TEAM_TASK', 'CHALLENGE', 'MARKETPLACE']).optional(),
      mode: z.enum(['CHOICE', 'SOLO', 'ALL_MEMBERS']).optional()
    })
  },
  assign: {
    body: z.object({
      team_id: z.string().optional(),
      user_id: z.string().optional()
    })
  },
  submit: {
    body: z.object({
      proof_notes: z.string().optional()
    })
  },
  review: {
    body: z.object({
      status: z.enum(['COMPLETED', 'REJECTED']).optional(),
      feedback: z.string().optional()
    })
  }
};

export const teamSchemas = {
  create: {
    body: z.object({
      name: z.string().trim().min(1, 'Team name is required'),
      captain_id: z.string().optional(),
      member_ids: z.array(z.string()).optional()
    })
  },
  pointOverride: {
    body: z.object({
      user_id: z.string().min(1, 'User ID is required'),
      custom_point_share: z.number().min(0, 'Point share cannot be negative')
    })
  },
  dissolve: {
    body: z.object({
      reason: z.string().optional()
    })
  }
};

export const hallOfFameSchemas = {
  award: {
    body: z.object({
      title_name: z.string().trim().min(1, 'Title name is required'),
      category: z.string().optional(),
      awarded_to_user_id: z.string().nullable().optional()
    })
  }
};
