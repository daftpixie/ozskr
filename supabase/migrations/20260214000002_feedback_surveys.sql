-- Feedback micro-surveys for key moments in the user journey
CREATE TABLE feedback_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  trigger_point TEXT NOT NULL CHECK (trigger_point IN (
    'first_generation', 'first_publish', 'third_agent', 'first_schedule', 'weekly_checkin'
  )),
  response TEXT NOT NULL CHECK (char_length(response) <= 500),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback_surveys ENABLE ROW LEVEL SECURITY;

-- Users can submit their own surveys
CREATE POLICY "Users can submit surveys"
  ON feedback_surveys FOR INSERT
  TO authenticated
  WITH CHECK (wallet_address = auth.uid()::text);

-- Users can read their own surveys (to check if already answered)
CREATE POLICY "Users can read own surveys"
  ON feedback_surveys FOR SELECT
  TO authenticated
  USING (wallet_address = auth.uid()::text);

-- Service role reads all surveys (admin dashboard)
CREATE POLICY "Service role reads surveys"
  ON feedback_surveys FOR SELECT
  USING (auth.role() = 'service_role');

CREATE INDEX idx_surveys_wallet ON feedback_surveys(wallet_address);
CREATE INDEX idx_surveys_trigger ON feedback_surveys(trigger_point);
CREATE INDEX idx_surveys_created ON feedback_surveys(created_at DESC);
