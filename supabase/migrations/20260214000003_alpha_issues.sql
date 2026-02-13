-- Alpha issues table for bug triage during alpha testing
CREATE TABLE alpha_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wontfix')),
  reporter_wallet TEXT,
  admin_notes TEXT,
  related_feature TEXT,
  survey_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE alpha_issues ENABLE ROW LEVEL SECURITY;

-- Only service role can manage issues (admin API uses service role client)
CREATE POLICY "Service role manages issues"
  ON alpha_issues FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_issues_severity ON alpha_issues(severity);
CREATE INDEX idx_issues_status ON alpha_issues(status);
CREATE INDEX idx_issues_created ON alpha_issues(created_at DESC);
