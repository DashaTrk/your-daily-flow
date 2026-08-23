CREATE TABLE public.digest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track text NOT NULL,
  section text NOT NULL DEFAULT 'declarations',
  student_name text NOT NULL,
  comment text NOT NULL DEFAULT '',
  flagged boolean NOT NULL DEFAULT false,
  week_start date NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_entries TO authenticated;
GRANT ALL ON public.digest_entries TO service_role;
ALTER TABLE public.digest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own digest entries" ON public.digest_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tt_digest_entries BEFORE UPDATE ON public.digest_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.digest_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track text NOT NULL,
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, track)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_weeks TO authenticated;
GRANT ALL ON public.digest_weeks TO service_role;
ALTER TABLE public.digest_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own digest weeks" ON public.digest_weeks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tt_digest_weeks BEFORE UPDATE ON public.digest_weeks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.digest_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track text NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  content text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_reports TO authenticated;
GRANT ALL ON public.digest_reports TO service_role;
ALTER TABLE public.digest_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own digest reports" ON public.digest_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);