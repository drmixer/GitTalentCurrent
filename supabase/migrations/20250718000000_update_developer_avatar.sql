CREATE OR REPLACE FUNCTION public.update_developer_avatar()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.developers
  SET avatar_url = NEW.avatar_url
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_avatar_update
AFTER UPDATE OF avatar_url ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_developer_avatar();
