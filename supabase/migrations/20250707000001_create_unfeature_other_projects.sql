CREATE OR REPLACE FUNCTION unfeature_other_projects()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.featured = true THEN
    UPDATE portfolio_items
    SET featured = false
    WHERE developer_id = NEW.developer_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unfeature_other_projects_trigger
BEFORE UPDATE ON portfolio_items
FOR EACH ROW
EXECUTE FUNCTION unfeature_other_projects();
