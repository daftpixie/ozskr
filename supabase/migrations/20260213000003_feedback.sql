-- Feedback table for in-app user feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  message TEXT,
  page_url TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit feedback
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (wallet_address = auth.uid()::text);

-- Service role reads feedback (admin dashboard)
CREATE POLICY "Service role reads feedback"
  ON feedback FOR SELECT
  USING (auth.role() = 'service_role');

CREATE INDEX idx_feedback_wallet ON feedback(wallet_address);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
