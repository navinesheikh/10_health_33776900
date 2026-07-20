-- FitTrack marker account and sample fitness data
USE health;

INSERT INTO users (
  username,
  first_name,
  last_name,
  email,
  hashed_password,
  role
)
VALUES (
  'gold',
  'Goldsmiths',
  'Marker',
  'gold@example.com',
  '$2b$10$/3Zmz7WT/wOJi9GfNw2uhe8iaOvkHihUyt7n.RC.iBjb0K3dZLrCG',
  'admin'
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  email = VALUES(email),
  hashed_password = VALUES(hashed_password),
  role = VALUES(role);

SET @gold_user_id = (
  SELECT id FROM users WHERE username = 'gold' LIMIT 1
);

INSERT INTO workouts (
  user_id,
  exercise_name,
  category,
  duration_minutes,
  calories_burned,
  workout_date,
  notes
)
SELECT @gold_user_id, 'Morning Walk', 'Walking', 25, 120, '2026-07-18',
       'A brisk walk through the local park.'
WHERE NOT EXISTS (
  SELECT 1 FROM workouts
  WHERE user_id = @gold_user_id
    AND exercise_name = 'Morning Walk'
    AND workout_date = '2026-07-18'
);

INSERT INTO workouts (
  user_id,
  exercise_name,
  category,
  duration_minutes,
  calories_burned,
  workout_date,
  notes
)
SELECT @gold_user_id, 'Full Body Strength', 'Strength', 45, 280, '2026-07-19',
       'Squats, presses, rows and core exercises.'
WHERE NOT EXISTS (
  SELECT 1 FROM workouts
  WHERE user_id = @gold_user_id
    AND exercise_name = 'Full Body Strength'
    AND workout_date = '2026-07-19'
);

INSERT INTO workouts (
  user_id,
  exercise_name,
  category,
  duration_minutes,
  calories_burned,
  workout_date,
  notes
)
SELECT @gold_user_id, 'Mobility Session', 'Flexibility', 15, 55, '2026-07-20',
       'Hip, shoulder and ankle mobility routine.'
WHERE NOT EXISTS (
  SELECT 1 FROM workouts
  WHERE user_id = @gold_user_id
    AND exercise_name = 'Mobility Session'
    AND workout_date = '2026-07-20'
);
