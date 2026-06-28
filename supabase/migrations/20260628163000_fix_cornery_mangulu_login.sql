-- ============================================================
-- Fix login for Cornery Mangulu (cmangulu@gmail.com)
-- Ensures auth.users, auth.identities, and user_profiles are correct
-- ============================================================

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get existing user id if present
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'cmangulu@gmail.com'
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- User exists — reset password and ensure email is confirmed
        UPDATE auth.users
        SET
            encrypted_password    = crypt('Engera12345', gen_salt('bf', 10)),
            email_confirmed_at    = COALESCE(email_confirmed_at, now()),
            confirmation_token    = '',
            recovery_token        = '',
            updated_at            = now(),
            raw_user_meta_data    = jsonb_build_object('full_name', 'Cornery Mangulu', 'role', 'legal_officer'),
            raw_app_meta_data     = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            aud                   = 'authenticated',
            role                  = 'authenticated',
            is_sso_user           = false,
            is_anonymous          = false
        WHERE id = v_user_id;

        RAISE NOTICE 'Updated existing user cmangulu@gmail.com (id: %)', v_user_id;
    ELSE
        -- Create new user
        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous,
            confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at,
            email_change_token_new, email_change, email_change_sent_at,
            email_change_token_current, email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at,
            phone, phone_change, phone_change_token, phone_change_sent_at
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'cmangulu@gmail.com',
            crypt('Engera12345', gen_salt('bf', 10)),
            now(), now(), now(),
            jsonb_build_object('full_name', 'Cornery Mangulu', 'role', 'legal_officer'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            null, '', '', null
        );

        RAISE NOTICE 'Created new user cmangulu@gmail.com (id: %)', v_user_id;
    END IF;

    -- Ensure auth.identities row exists (required for Supabase password login)
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        'cmangulu@gmail.com',
        jsonb_build_object(
            'sub',   v_user_id::TEXT,
            'email', 'cmangulu@gmail.com',
            'email_verified', true,
            'provider', 'email'
        ),
        'email',
        now(),
        now(),
        now()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE
        SET identity_data = jsonb_build_object(
                'sub',   v_user_id::TEXT,
                'email', 'cmangulu@gmail.com',
                'email_verified', true,
                'provider', 'email'
            ),
            updated_at = now();

    -- Upsert user_profiles with correct enum cast
    INSERT INTO public.user_profiles (
        id, email, full_name, role, initials, is_active, created_at, updated_at
    ) VALUES (
        v_user_id,
        'cmangulu@gmail.com',
        'Cornery Mangulu',
        'legal_officer'::public.user_role,
        'CM',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
        SET full_name  = 'Cornery Mangulu',
            role       = 'legal_officer'::public.user_role,
            initials   = 'CM',
            is_active  = true,
            updated_at = now();

    RAISE NOTICE 'cmangulu@gmail.com login fix complete (id: %)', v_user_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Fix failed: %', SQLERRM;
END $$;
