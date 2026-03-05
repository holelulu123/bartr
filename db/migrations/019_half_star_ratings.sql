-- Migration 019: Allow half-star ratings (0, 0.5, 1, ... 5)

-- Change score column from SMALLINT to NUMERIC(2,1)
ALTER TABLE ratings
  ALTER COLUMN score TYPE NUMERIC(2,1);

-- Drop old CHECK constraint and add new one enforcing 0.5 increments
ALTER TABLE ratings
  DROP CONSTRAINT IF EXISTS ratings_score_check;

ALTER TABLE ratings
  ADD CONSTRAINT ratings_score_check
    CHECK (score >= 0 AND score <= 5 AND (score * 2) = FLOOR(score * 2));
