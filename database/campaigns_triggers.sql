-- Trigger function to update campaign stats based on audit_results
CREATE OR REPLACE FUNCTION update_campaign_stats_from_audit() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH stats AS (
    SELECT
      count(*) as completed_count,
      avg(share_of_voice) as avg_sov,
      avg(average_rank) as avg_rank,
      sum(total_citations) as total_cits
    FROM audit_results
    WHERE campaign_id = NEW.campaign_id
  )
  UPDATE campaigns
  SET
    completed_prompts = (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id), -- Recount total completed
    avg_sov = COALESCE(stats.avg_sov, 0),
    avg_rank = stats.avg_rank,
    total_citations = COALESCE(stats.total_cits, 0),
    updated_at = NOW(),
    status = CASE 
      WHEN (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id) >= total_prompts THEN 'completed' 
      ELSE 'running' 
    END
  FROM stats
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for audit_results
DROP TRIGGER IF EXISTS update_campaign_stats_audit_trigger ON audit_results;
CREATE TRIGGER update_campaign_stats_audit_trigger
AFTER INSERT OR UPDATE ON audit_results
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats_from_audit();

-- Trigger function to update campaign stats based on schedule_runs (if used)
CREATE OR REPLACE FUNCTION update_campaign_stats_from_schedule() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH stats AS (
    SELECT
      count(*) as completed_count,
      avg(share_of_voice) as avg_sov,
      avg(average_rank) as avg_rank,
      sum(total_citations) as total_cits
    FROM schedule_runs
    WHERE campaign_id = NEW.campaign_id AND status = 'completed'
  )
  UPDATE campaigns
  SET
    completed_prompts = stats.completed_count,
    avg_sov = COALESCE(stats.avg_sov, 0),
    avg_rank = stats.avg_rank,
    total_citations = COALESCE(stats.total_cits, 0),
    updated_at = NOW(),
     status = CASE 
      WHEN stats.completed_count >= total_prompts THEN 'completed' 
      ELSE 'running' 
    END
  FROM stats
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for schedule_runs
DROP TRIGGER IF EXISTS update_campaign_stats_schedule_trigger ON schedule_runs;
CREATE TRIGGER update_campaign_stats_schedule_trigger
AFTER INSERT OR UPDATE ON schedule_runs
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats_from_schedule();
