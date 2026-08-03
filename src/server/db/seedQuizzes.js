import { db } from './database.js';
import { QuizModel } from '../models/Quiz.js';

/**
 * Baseline quizzes and puzzles. Idempotent: keyed on a stable id so re-running
 * on an existing database is a no-op.
 */
const QUIZZES = [
  {
    id: 'qz_js_fundamentals',
    title: 'JavaScript Fundamentals',
    description: 'Scope, types, and the parts of JS that trip everyone up.',
    category: 'javascript',
    difficulty: 'EASY',
    xpReward: 60,
    passPercent: 70,
    questions: [
      {
        prompt: 'What does `typeof null` return?',
        questionType: 'MCQ',
        options: ['"null"', '"object"', '"undefined"', '"boolean"'],
        correctAnswer: '"object"',
        explanation: 'A long-standing bug kept for backwards compatibility — null has the same type tag as objects.',
        points: 1
      },
      {
        prompt: 'Which declarations are block-scoped?',
        questionType: 'MULTI',
        options: ['var', 'let', 'const', 'function (declaration)'],
        correctAnswer: ['let', 'const'],
        explanation: '`var` is function-scoped; `let` and `const` are block-scoped.',
        points: 2
      },
      {
        prompt: '`[] == false` evaluates to true.',
        questionType: 'TRUE_FALSE',
        correctAnswer: 'true',
        explanation: 'Both sides coerce to 0 under loose equality. Use === to avoid this.',
        points: 1
      },
      {
        prompt: 'What is logged?',
        questionType: 'CODE_OUTPUT',
        codeSnippet: 'const a = [1, 2, 3];\nconst b = a;\nb.push(4);\nconsole.log(a.length);',
        correctAnswer: ['4'],
        explanation: 'Arrays are reference types — `b` points at the same array as `a`.',
        points: 2
      }
    ]
  },
  {
    id: 'qz_css_layout',
    title: 'CSS Layout & Flexbox',
    description: 'Flexbox, Grid, and the box model in practice.',
    category: 'css',
    difficulty: 'MEDIUM',
    xpReward: 80,
    passPercent: 70,
    questions: [
      {
        prompt: 'Which property controls alignment along the flex container\'s main axis?',
        questionType: 'MCQ',
        options: ['align-items', 'justify-content', 'align-content', 'place-items'],
        correctAnswer: 'justify-content',
        explanation: '`justify-content` works on the main axis; `align-items` works on the cross axis.',
        points: 1
      },
      {
        prompt: 'With `box-sizing: border-box`, what does the declared width include?',
        questionType: 'MCQ',
        options: ['Content only', 'Content and padding', 'Content, padding, and border', 'Content, padding, border, and margin'],
        correctAnswer: 'Content, padding, and border',
        explanation: 'Margin always sits outside the box, regardless of box-sizing.',
        points: 2
      },
      {
        prompt: 'Which CSS function creates a responsive column track that never drops below 200px?',
        questionType: 'SHORT_ANSWER',
        correctAnswer: ['minmax', 'minmax()'],
        explanation: '`repeat(auto-fit, minmax(200px, 1fr))` is the classic responsive grid idiom.',
        points: 2
      }
    ]
  },
  {
    id: 'qz_sql_basics',
    title: 'SQL & Data Modelling',
    description: 'Joins, indexes, and the traps in aggregate queries.',
    category: 'databases',
    difficulty: 'HARD',
    xpReward: 100,
    passPercent: 75,
    questions: [
      {
        prompt: 'Which JOIN keeps every row from the left table even without a match?',
        questionType: 'MCQ',
        options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'RIGHT JOIN'],
        correctAnswer: 'LEFT JOIN',
        explanation: 'Unmatched right-side columns come back as NULL.',
        points: 1
      },
      {
        prompt: 'In SQLite, is string comparison with = case-sensitive by default?',
        questionType: 'TRUE_FALSE',
        correctAnswer: 'true',
        explanation: 'Yes — unless the column uses COLLATE NOCASE. This exact trap once hid every score in Forge behind a lowercase/uppercase mismatch.',
        points: 2
      },
      {
        prompt: 'Which clause filters rows AFTER aggregation?',
        questionType: 'SHORT_ANSWER',
        correctAnswer: ['having', 'HAVING'],
        explanation: 'WHERE filters before grouping; HAVING filters the grouped result.',
        points: 2
      }
    ]
  }
];

const PUZZLES = [
  {
    id: 'pz_closure_counter',
    title: 'The Closure Counter',
    description: 'A classic loop-and-closure brain teaser.',
    category: 'javascript',
    difficulty: 'MEDIUM',
    xpReward: 40,
    dayOffset: 0,
    questions: [
      {
        prompt: 'What does this print, and why?',
        questionType: 'CODE_OUTPUT',
        codeSnippet: 'for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}',
        correctAnswer: ['3 3 3', '333', '3,3,3', '3 3 3 '],
        hint: 'Think about when the callbacks actually run, and what `var` scopes to.',
        explanation: '`var` is function-scoped, so all three callbacks close over the same binding, which is 3 by the time they run. Swap in `let` for 0 1 2.',
        points: 3
      }
    ]
  },
  {
    id: 'pz_equality_trap',
    title: 'The Equality Trap',
    description: 'One line, one surprising boolean.',
    category: 'javascript',
    difficulty: 'HARD',
    xpReward: 40,
    dayOffset: -1,
    questions: [
      {
        prompt: 'What is the value of `0.1 + 0.2 === 0.3`?',
        questionType: 'TRUE_FALSE',
        correctAnswer: 'false',
        hint: 'Floating point is binary, and 0.1 has no exact binary representation.',
        explanation: '0.1 + 0.2 is 0.30000000000000004. Compare with a small epsilon instead.',
        points: 3
      }
    ]
  }
];

function isoDay(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function seedQuizzes(createdBy = null) {
  const exists = db.prepare(`SELECT 1 FROM quizzes WHERE id = ? LIMIT 1`);
  let created = 0;

  const seedOne = (spec, kind, scheduledFor) => {
    if (exists.get(spec.id)) return;
    db.prepare(`
      INSERT INTO quizzes (id, title, description, category, kind, difficulty, time_limit_seconds,
        xp_reward, pass_percent, max_attempts, scheduled_for, is_published, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(spec.id, spec.title, spec.description, spec.category, kind, spec.difficulty,
      spec.xpReward, spec.passPercent ?? 70, scheduledFor, createdBy);

    for (const question of spec.questions) {
      QuizModel.addQuestion(spec.id, question);
    }
    created += 1;
  };

  const run = db.transaction(() => {
    for (const quiz of QUIZZES) seedOne(quiz, 'QUIZ', null);
    for (const puzzle of PUZZLES) seedOne(puzzle, 'PUZZLE', isoDay(puzzle.dayOffset ?? 0));
  });
  run();

  return { created };
}
