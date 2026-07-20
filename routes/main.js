const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const db = global.db;
const saltRounds = 10;
const siteName = 'FitTrack';
const categories = ['Strength', 'Cardio', 'Flexibility', 'Sports', 'Walking', 'Other'];
const basePath = (process.env.HEALTH_BASE_PATH || 'http://localhost:8000').replace(/\/$/, '');

function pageData(extra = {}) {
  return Object.assign({ siteName, categories }, extra);
}

function redirectTo(res, path) {
  return res.redirect(`${basePath}${path}`);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return redirectTo(res, '/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', pageData({
      title: 'Access denied',
      message: 'You must be an administrator to view this page.'
    }));
  }
  next();
}

function recordLoginAttempt(username, success) {
  db.query(
    'INSERT INTO login_audit (username, success) VALUES (?, ?)',
    [username || 'unknown', success ? 1 : 0],
    (error) => {
      if (error) {
        console.error('Could not record login attempt:', error.message);
      }
    }
  );
}

const workoutValidation = [
  body('exercise_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Exercise name must be between 2 and 100 characters.'),
  body('category')
    .isIn(categories)
    .withMessage('Choose a valid workout category.'),
  body('duration_minutes')
    .isInt({ min: 1, max: 600 })
    .withMessage('Duration must be between 1 and 600 minutes.'),
  body('calories_burned')
    .isInt({ min: 0, max: 5000 })
    .withMessage('Calories must be between 0 and 5000.'),
  body('workout_date')
    .isISO8601({ strict: true })
    .withMessage('Enter a valid workout date.'),
  body('notes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must contain no more than 500 characters.')
];

router.get('/', (req, res) => {
  res.render('index', pageData());
});

router.get('/about', (req, res) => {
  res.render('about', pageData());
});

router.get('/register', (req, res) => {
  res.render('register', pageData({ errors: [], formData: {} }));
});

router.post(
  '/register',
  [
    body('first_name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Enter your first name.'),
    body('last_name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Enter your last name.'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Enter a valid email address.')
      .normalizeEmail(),
    body('username')
      .trim()
      .matches(/^[A-Za-z0-9_]{3,30}$/)
      .withMessage('Username must be 3–30 characters using letters, numbers or underscores.'),
    body('password')
      .isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      })
      .withMessage('Password must have at least 8 characters, including lowercase, uppercase, a number and a symbol.')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('register', pageData({
        errors: errors.array(),
        formData: req.body
      }));
    }

    const { first_name, last_name, email, username, password } = req.body;

    bcrypt.hash(password, saltRounds, (hashError, hashedPassword) => {
      if (hashError) {
        return next(hashError);
      }

      const sql = `
        INSERT INTO users
          (username, first_name, last_name, email, hashed_password, role)
        VALUES (?, ?, ?, ?, ?, 'member')
      `;

      db.query(
        sql,
        [username, first_name, last_name, email, hashedPassword],
        (error) => {
          if (error && error.code === 'ER_DUP_ENTRY') {
            return res.status(400).render('register', pageData({
              errors: [{ msg: 'That username or email address is already registered.' }],
              formData: req.body
            }));
          }

          if (error) {
            return next(error);
          }

          redirectTo(res, '/login?registered=1');
        }
      );
    });
  }
);

router.get('/login', (req, res) => {
  res.render('login', pageData({
    registered: req.query.registered === '1',
    error: null
  }));
});

router.post(
  '/login',
  [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    const username = req.body.username || '';

    if (!errors.isEmpty()) {
      recordLoginAttempt(username, false);
      return res.status(400).render('login', pageData({
        registered: false,
        error: 'Enter both your username and password.'
      }));
    }

    const sql = `
      SELECT id, username, first_name, hashed_password, role
      FROM users
      WHERE username = ?
    `;

    db.query(sql, [username], (error, rows) => {
      if (error) {
        return next(error);
      }

      if (rows.length !== 1) {
        recordLoginAttempt(username, false);
        return res.status(401).render('login', pageData({
          registered: false,
          error: 'Incorrect username or password.'
        }));
      }

      const user = rows[0];
      bcrypt.compare(req.body.password, user.hashed_password, (compareError, matches) => {
        if (compareError) {
          return next(compareError);
        }

        recordLoginAttempt(username, matches);

        if (!matches) {
          return res.status(401).render('login', pageData({
            registered: false,
            error: 'Incorrect username or password.'
          }));
        }

        req.session.user = {
          id: user.id,
          username: user.username,
          firstName: user.first_name,
          role: user.role
        };

        redirectTo(res, '/dashboard');
      });
    });
  }
);

router.post('/logout', requireLogin, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }
    res.clearCookie('connect.sid');
    redirectTo(res, '/');
  });
});

router.get('/dashboard', requireLogin, (req, res, next) => {
  const userId = req.session.user.id;
  const summarySql = `
    SELECT
      COUNT(*) AS workout_count,
      COALESCE(SUM(duration_minutes), 0) AS total_minutes,
      COALESCE(SUM(calories_burned), 0) AS total_calories
    FROM workouts
    WHERE user_id = ?
  `;
  const recentSql = `
    SELECT id, exercise_name, category, duration_minutes,
           calories_burned, workout_date
    FROM workouts
    WHERE user_id = ?
    ORDER BY workout_date DESC, id DESC
    LIMIT 5
  `;

  db.query(summarySql, [userId], (summaryError, summaryRows) => {
    if (summaryError) {
      return next(summaryError);
    }

    db.query(recentSql, [userId], (recentError, recentRows) => {
      if (recentError) {
        return next(recentError);
      }

      res.render('dashboard', pageData({
        summary: summaryRows[0],
        recentWorkouts: recentRows
      }));
    });
  });
});

router.get('/workouts', requireLogin, (req, res, next) => {
  const sql = `
    SELECT id, exercise_name, category, duration_minutes,
           calories_burned, workout_date, notes
    FROM workouts
    WHERE user_id = ?
    ORDER BY workout_date DESC, id DESC
  `;

  db.query(sql, [req.session.user.id], (error, rows) => {
    if (error) {
      return next(error);
    }
    res.render('workouts', pageData({ workouts: rows }));
  });
});

router.get('/workouts/quick', requireLogin, (req, res, next) => {
  const sql = `
    SELECT id, exercise_name, category, duration_minutes,
           calories_burned, workout_date
    FROM workouts
    WHERE user_id = ? AND duration_minutes <= 30
    ORDER BY duration_minutes ASC, workout_date DESC
  `;

  db.query(sql, [req.session.user.id], (error, rows) => {
    if (error) {
      return next(error);
    }
    res.render('quick-workouts', pageData({ workouts: rows }));
  });
});

router.get('/workouts/new', requireLogin, (req, res) => {
  res.render('workout-form', pageData({
    title: 'Log a workout',
    action: '/workouts',
    submitLabel: 'Save workout',
    errors: [],
    formData: {}
  }));
});

router.post('/workouts', requireLogin, workoutValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('workout-form', pageData({
      title: 'Log a workout',
      action: '/workouts',
      submitLabel: 'Save workout',
      errors: errors.array(),
      formData: req.body
    }));
  }

  const sql = `
    INSERT INTO workouts
      (user_id, exercise_name, category, duration_minutes,
       calories_burned, workout_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    req.session.user.id,
    req.body.exercise_name,
    req.body.category,
    req.body.duration_minutes,
    req.body.calories_burned,
    req.body.workout_date,
    req.body.notes || null
  ];

  db.query(sql, values, (error) => {
    if (error) {
      return next(error);
    }
    redirectTo(res, '/workouts');
  });
});

router.get('/workouts/:id/edit', requireLogin, (req, res, next) => {
  const sql = `
    SELECT id, exercise_name, category, duration_minutes,
           calories_burned, workout_date, notes
    FROM workouts
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [req.params.id, req.session.user.id], (error, rows) => {
    if (error) {
      return next(error);
    }
    if (rows.length !== 1) {
      return res.status(404).render('error', pageData({
        title: 'Workout not found',
        message: 'That workout does not exist or does not belong to your account.'
      }));
    }

    const workout = rows[0];
    if (workout.workout_date instanceof Date) {
      workout.workout_date = workout.workout_date.toISOString().slice(0, 10);
    }

    res.render('workout-form', pageData({
      title: 'Edit workout',
      action: `/workouts/${workout.id}/edit`,
      submitLabel: 'Update workout',
      errors: [],
      formData: workout
    }));
  });
});

router.post('/workouts/:id/edit', requireLogin, workoutValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('workout-form', pageData({
      title: 'Edit workout',
      action: `/workouts/${req.params.id}/edit`,
      submitLabel: 'Update workout',
      errors: errors.array(),
      formData: Object.assign({ id: req.params.id }, req.body)
    }));
  }

  const sql = `
    UPDATE workouts
    SET exercise_name = ?, category = ?, duration_minutes = ?,
        calories_burned = ?, workout_date = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `;
  const values = [
    req.body.exercise_name,
    req.body.category,
    req.body.duration_minutes,
    req.body.calories_burned,
    req.body.workout_date,
    req.body.notes || null,
    req.params.id,
    req.session.user.id
  ];

  db.query(sql, values, (error, result) => {
    if (error) {
      return next(error);
    }
    if (result.affectedRows !== 1) {
      return res.status(404).render('error', pageData({
        title: 'Workout not found',
        message: 'That workout could not be updated.'
      }));
    }
    redirectTo(res, '/workouts');
  });
});

router.post('/workouts/:id/delete', requireLogin, (req, res, next) => {
  db.query(
    'DELETE FROM workouts WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.user.id],
    (error) => {
      if (error) {
        return next(error);
      }
      redirectTo(res, '/workouts');
    }
  );
});

router.get('/search', requireLogin, (req, res) => {
  res.render('search', pageData({ errors: [], keyword: '' }));
});

router.post(
  '/search-results',
  requireLogin,
  [
    body('keyword')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Enter at least 2 characters to search.')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('search', pageData({
        errors: errors.array(),
        keyword: req.body.keyword
      }));
    }

    const searchValue = `%${req.body.keyword}%`;
    const sql = `
      SELECT id, exercise_name, category, duration_minutes,
             calories_burned, workout_date, notes
      FROM workouts
      WHERE user_id = ?
        AND (exercise_name LIKE ? OR category LIKE ? OR notes LIKE ?)
      ORDER BY workout_date DESC, id DESC
    `;

    db.query(
      sql,
      [req.session.user.id, searchValue, searchValue, searchValue],
      (error, rows) => {
        if (error) {
          return next(error);
        }
        res.render('search-results', pageData({
          keyword: req.body.keyword,
          workouts: rows
        }));
      }
    );
  }
);

router.get('/admin/users', requireAdmin, (req, res, next) => {
  const sql = `
    SELECT id, username, first_name, last_name, email, role, created_at
    FROM users
    ORDER BY created_at DESC
  `;
  db.query(sql, (error, rows) => {
    if (error) {
      return next(error);
    }
    res.render('admin-users', pageData({ users: rows }));
  });
});

router.get('/admin/audit', requireAdmin, (req, res, next) => {
  const sql = `
    SELECT id, username, success, attempted_at
    FROM login_audit
    ORDER BY attempted_at DESC
    LIMIT 100
  `;
  db.query(sql, (error, rows) => {
    if (error) {
      return next(error);
    }
    res.render('admin-audit', pageData({ logs: rows }));
  });
});

module.exports = router;
