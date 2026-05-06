-- ============================================================
-- CollateralMS — Create Admin Superuser
-- Creates user: Admin / admin@collateralms.com / mangulu123
-- Role: system_admin (full access to users, roles, permissions)
-- ============================================================

DO $$
DECLARE
    v_admin_uuid UUID;
    v_existing_id UUID;
BEGIN
    -- Check if admin user already exists by email
    SELECT id INTO v_existing_id
    FROM auth.users
    WHERE email = 'admin@collateralms.com'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- User already exists — ensure profile has system_admin role
        UPDATE public.user_profiles
        SET role = 'system_admin'::public.user_role,
            full_name = 'Admin',
            initials = 'AD',
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_existing_id;

        RAISE NOTICE 'Admin user already exists (id: %), role updated to system_admin.', v_existing_id;
    ELSE
        -- Generate a new UUID for the admin user
        v_admin_uuid := gen_random_uuid();

        -- Insert into auth.users with all required fields
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_user_meta_data,
            raw_app_meta_data,
            is_sso_user,
            is_anonymous,
            confirmation_token,
            confirmation_sent_at,
            recovery_token,
            recovery_sent_at,
            email_change_token_new,
            email_change,
            email_change_sent_at,
            email_change_token_current,
            email_change_confirm_status,
            reauthentication_token,
            reauthentication_sent_at,
            phone,
            phone_change,
            phone_change_token,
            phone_change_sent_at
        ) VALUES (
            v_admin_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'admin@collateralms.com',
            crypt('mangulu123', gen_salt('bf', 10)),
            now(),
            now(),
            now(),
            jsonb_build_object('full_name', 'Admin', 'role', 'system_admin'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false,
            false,
            '',
            null,
            '',
            null,
            '',
            '',
            null,
            '',
            0,
            '',
            null,
            null,
            '',
            '',
            null
        )
        ON CONFLICT (id) DO NOTHING;

        -- Insert user_profiles directly (in case trigger does not exist or has not fired)
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            initials,
            role,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            v_admin_uuid,
            'admin@collateralms.com',
            'Admin',
            'AD',
            'system_admin'::public.user_role,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE
            SET role      = 'system_admin'::public.user_role,
                full_name = 'Admin',
                initials  = 'AD',
                is_active = true,
                updated_at = CURRENT_TIMESTAMP;

        -- Also handle unique constraint on email if it exists
        -- (covers case where trigger already inserted a row with same email)
        UPDATE public.user_profiles
        SET role      = 'system_admin'::public.user_role,
            full_name = 'Admin',
            initials  = 'AD',
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = 'admin@collateralms.com'
          AND id != v_admin_uuid;

        RAISE NOTICE 'Admin user created successfully (id: %).', v_admin_uuid;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Admin user creation failed: %', SQLERRM;
END $$;
