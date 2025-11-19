-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles table
CREATE TABLE public.roles (
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'developer'::text, 'admin'::text])),
  CONSTRAINT roles_pkey PRIMARY KEY (role)
);

-- Insert default roles
INSERT INTO public.roles (role) VALUES ('user'), ('developer'), ('admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text UNIQUE,
  display_name text,
  role text NOT NULL DEFAULT 'user'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  avatar_url text,
  banner_url text,
  bio text DEFAULT ''::text,
  website_url text DEFAULT ''::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_role_fkey FOREIGN KEY (role) REFERENCES public.roles(role)
);

-- Create developers table
CREATE TABLE public.developers (
  id uuid NOT NULL,
  org_name text,
  verified boolean NOT NULL DEFAULT false,
  bio text,
  avatar_url text,
  banner_url text,
  website_url text,
  social_x text,
  social_linkedin text,
  location text,
  established_on date,
  profile_picture_url text,
  website text,
  contact_email text,
  CONSTRAINT developers_pkey PRIMARY KEY (id),
  CONSTRAINT developers_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);

-- Create categories table
CREATE TABLE public.categories (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- Create apps table
CREATE TABLE public.apps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon_url text,
  publisher_id uuid NOT NULL,
  is_listed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category_id integer,
  banner_video_url text,
  video_thumbnail text,
  CONSTRAINT apps_pkey PRIMARY KEY (id),
  CONSTRAINT apps_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.developers(id),
  CONSTRAINT apps_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- Create app_versions table
CREATE TABLE public.app_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL,
  version text NOT NULL,
  platform text NOT NULL,
  min_os_version text,
  architecture text,
  changelog text,
  size_bytes bigint,
  sha256 text,
  storage_key text,
  is_prerelease boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  external_url text,
  binaries jsonb,
  CONSTRAINT app_versions_pkey PRIMARY KEY (id),
  CONSTRAINT app_versions_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id)
);

-- Create reviews table
CREATE TABLE public.reviews (
  id bigserial PRIMARY KEY,
  app_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  UNIQUE(app_id, user_id)
);

-- Create screenshots table
CREATE TABLE public.screenshots (
  id bigserial PRIMARY KEY,
  app_id uuid NOT NULL,
  storage_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  url text,
  CONSTRAINT screenshots_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id)
);

-- Create installs table
CREATE TABLE public.installs (
  id bigserial PRIMARY KEY,
  app_id uuid NOT NULL,
  version_id uuid,
  user_id uuid,
  platform text,
  installed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT installs_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id),
  CONSTRAINT installs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.app_versions(id),
  CONSTRAINT installs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create app_categories junction table
CREATE TABLE public.app_categories (
  app_id uuid NOT NULL,
  category_id bigint NOT NULL,
  CONSTRAINT app_categories_pkey PRIMARY KEY (app_id, category_id),
  CONSTRAINT app_categories_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id),
  CONSTRAINT app_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_apps_publisher ON public.apps(publisher_id);
CREATE INDEX idx_apps_category ON public.apps(category_id);
CREATE INDEX idx_reviews_app ON public.reviews(app_id);
CREATE INDEX idx_screenshots_app ON public.screenshots(app_id);
CREATE INDEX idx_installs_app ON public.installs(app_id);
