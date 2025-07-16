CREATE OR REPLACE FUNCTION public.update_user_avatar_from_raw_meta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET avatar_url = NEW.raw_user_meta_data->>'avatar_url'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_raw_meta_data_update
AFTER UPDATE OF raw_user_meta_data ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_user_avatar_from_raw_meta();
