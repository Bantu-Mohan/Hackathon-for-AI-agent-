-- =============================================
-- AI Task Execution Agent — Supabase Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Users Tasks
CREATE TABLE IF NOT EXISTS users_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Steps
CREATE TABLE IF NOT EXISTS task_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES users_tasks(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  step_title TEXT NOT NULL,
  explanation TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'retry'))
);

-- Step Submissions
CREATE TABLE IF NOT EXISTS step_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID REFERENCES task_steps(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  ai_feedback TEXT,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Row Level Security & Grants
-- =============================================

-- Grant basic access to the authenticated role
GRANT ALL ON users_tasks TO authenticated;
GRANT ALL ON task_steps TO authenticated;
GRANT ALL ON step_submissions TO authenticated;

-- Enable RLS
ALTER TABLE users_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_submissions ENABLE ROW LEVEL SECURITY;

-- 1) Users Tasks Policies
-- Drop existing first in case you are re-running this
DROP POLICY IF EXISTS "Users manage own tasks" ON users_tasks;
DROP POLICY IF EXISTS "Users select own tasks" ON users_tasks;
DROP POLICY IF EXISTS "Users insert own tasks" ON users_tasks;

CREATE POLICY "Users select own tasks" ON users_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks" ON users_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks" ON users_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks" ON users_tasks FOR DELETE USING (auth.uid() = user_id);

-- 2) Task Steps Policies
DROP POLICY IF EXISTS "Users manage own task steps" ON task_steps;
DROP POLICY IF EXISTS "Users select own task steps" ON task_steps;
DROP POLICY IF EXISTS "Users insert own task steps" ON task_steps;

CREATE POLICY "Users select own task steps" ON task_steps FOR SELECT USING (
  task_id IN (SELECT id FROM users_tasks WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert own task steps" ON task_steps FOR INSERT WITH CHECK (
  task_id IN (SELECT id FROM users_tasks WHERE user_id = auth.uid())
);
CREATE POLICY "Users update own task steps" ON task_steps FOR UPDATE USING (
  task_id IN (SELECT id FROM users_tasks WHERE user_id = auth.uid())
);

-- 3) Step Submissions Policies
DROP POLICY IF EXISTS "Users manage own submissions" ON step_submissions;
DROP POLICY IF EXISTS "Users select own submissions" ON step_submissions;
DROP POLICY IF EXISTS "Users insert own submissions" ON step_submissions;

CREATE POLICY "Users select own submissions" ON step_submissions FOR SELECT USING (
  step_id IN (SELECT id FROM task_steps WHERE task_id IN (SELECT id FROM users_tasks WHERE user_id = auth.uid()))
);
CREATE POLICY "Users insert own submissions" ON step_submissions FOR INSERT WITH CHECK (
  step_id IN (SELECT id FROM task_steps WHERE task_id IN (SELECT id FROM users_tasks WHERE user_id = auth.uid()))
);
CREATE POLICY "Users update own submissions" ON step_submissions FOR UPDATE USING (
  step_id IN (SELECT id FROM task_steps WHERE task_id IN (SELECT id FROM users_tasks WHERE user_id = auth.uid()))
);
