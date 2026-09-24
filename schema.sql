-- Tạo bảng lưu kết quả bài quiz
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id    TEXT UNIQUE,
  quiz_id          TEXT,
  quiz_title       TEXT,
  student_name     TEXT,
  student_class    TEXT,
  student_email    TEXT,
  score            INTEGER,
  total_questions  INTEGER,
  percentage       INTEGER,
  status           TEXT,
  pass_score       INTEGER,
  duration_minutes INTEGER,
  submitted_at     TEXT,
  page             TEXT,
    user_agent       TEXT,
  attempt_number   INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT DEFAULT (datetime('now'))

);

-- Chỉ số để đếm số lần làm bài cho 1 học sinh / 1 quiz
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_student
ON quiz_attempts (quiz_id, student_name, student_class);