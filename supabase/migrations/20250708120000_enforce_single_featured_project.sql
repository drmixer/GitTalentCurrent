/*
  # Enforce Single Featured Project

  1. Changes
    - Create a function to unfeature all other portfolio items for a developer when one is marked as featured.
    - Create a trigger to call this function before a portfolio item is inserted or updated.

  2. Reason
    - To ensure that a developer can only have one featured project at a time.
*/

CREATE OR REPLACE FUNCTION unfeature_other_projects()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.featured THEN
    UPDATE portfolio_items
    SET featured = false
    WHERE developer_id = NEW.developer_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_featured_project
BEFORE INSERT OR UPDATE ON portfolio_items
FOR EACH ROW
EXECUTE FUNCTION unfeature_other_projects();
