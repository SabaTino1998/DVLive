-- Squashed auth schema and seed for the local DVLive service.

-- Table definitions copied from Bravigo baseline 20261027120000.
-- Only the auth/proxy dependencies are installed in this local test project.

CREATE TABLE IF NOT EXISTS "public"."bo_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "display_name" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "global_product_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "services_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'draft'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."bo_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "display_name" "text" DEFAULT ''::"text" NOT NULL,
    "country_code" "text" DEFAULT ''::"text" NOT NULL,
    "is_global" boolean DEFAULT false NOT NULL,
    "native_bundle_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hostname_staging" "text",
    "hostname_production" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'draft'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "avatar_url" "text",
    "total_points" integer DEFAULT 0,
    "points_this_week" integer DEFAULT 0,
    "points_expiry" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    "rank_position" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_completed" boolean DEFAULT false,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "avatar_traits" "jsonb" DEFAULT '{"style": "casual", "gender": "neutral", "interests": [], "accessories": [], "personality": []}'::"jsonb",
    "badge_name" "text" DEFAULT 'Rookie'::"text",
    "welcome_bonus_claimed" boolean DEFAULT false,
    "last_scratch_card_view" timestamp with time zone,
    "service_id" "uuid",
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "birth_date" "text" DEFAULT ''::"text" NOT NULL,
    "product_id" "uuid" NOT NULL
);

ALTER TABLE public.bo_services ADD PRIMARY KEY (id), ADD UNIQUE (slug);
ALTER TABLE public.bo_products ADD PRIMARY KEY (id), ADD UNIQUE (service_id, slug),
  ADD FOREIGN KEY (service_id) REFERENCES public.bo_services(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD PRIMARY KEY (id), ADD UNIQUE (id, service_id, product_id),
  ADD FOREIGN KEY (service_id) REFERENCES public.bo_services(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (product_id) REFERENCES public.bo_products(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX profiles_nickname_key ON public.profiles(nickname);

CREATE FUNCTION public.jwt_service_id() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(coalesce(auth.jwt()->>'service_id', auth.jwt()->'app_metadata'->>'service_id'), '')::uuid
$$;
CREATE FUNCTION public.jwt_product_id() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(coalesce(auth.jwt()->>'product_id', auth.jwt()->'app_metadata'->>'product_id'), '')::uuid
$$;
ALTER TABLE public.bo_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bo_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bo_services, public.bo_products, public.profiles FROM anon, authenticated;
GRANT ALL ON public.bo_services, public.bo_products, public.profiles TO service_role;
GRANT SELECT ON public.bo_services, public.bo_products, public.profiles TO authenticated;
CREATE POLICY services_select_current ON public.bo_services FOR SELECT TO authenticated
  USING (id = public.jwt_service_id());
CREATE POLICY products_select_current ON public.bo_products FOR SELECT TO authenticated
  USING (id = public.jwt_product_id() AND service_id = public.jwt_service_id());
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() AND service_id = public.jwt_service_id() AND product_id = public.jwt_product_id());

-- Stable identifiers/default product from Bravigo; local service slug is dvlive.
INSERT INTO public.bo_services(id, slug, display_name, description, status)
VALUES ('1927f41e-a809-49c9-9661-5a54a6177069', 'dvlive', 'DVLive', 'Gamified loyalty platform', 'active')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bo_products(id, service_id, slug, display_name, country_code, is_global, native_bundle_id, status, hostname_staging, hostname_production, is_default)
VALUES ('8a236df7-f1da-49d9-a255-d851b180b162', '1927f41e-a809-49c9-9661-5a54a6177069',
  'ma-bravigo', 'Bravigo MA', 'MA', false, NULL, 'active', 'bravigo.blast.dvbuilder.com', 'ma.bravigo.com', true)
ON CONFLICT (id) DO NOTHING;
