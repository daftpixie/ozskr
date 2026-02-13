-- Platform Metrics table for monitoring and cost tracking
CREATE TABLE platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'api_error', 'ai_inference_cost', 'social_publish_cost',
    'content_generation', 'user_signup', 'swap_executed'
  )),
  value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

-- Service role only — no user access
CREATE POLICY "Service role only"
  ON platform_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- Time-based index for dashboard queries
CREATE INDEX idx_metrics_type_time ON platform_metrics(metric_type, created_at DESC);

-- Daily aggregation view
CREATE VIEW daily_metrics AS
SELECT
  metric_type,
  DATE(created_at) as date,
  COUNT(*) as count,
  SUM(value) as total_value,
  AVG(value) as avg_value
FROM platform_metrics
GROUP BY metric_type, DATE(created_at);
