-- Seed user: Cornery Mangulu (Legal Officer)
DO $$
DECLARE
    new_user_uuid UUID := gen_random_uuid();
BEGIN
    -- Insert into auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES (
        new_user_uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'cmangulu@gmail.com',
        crypt('Engera12345', gen_salt('bf', 10)),
        now(),
        now(),
        now(),
        jsonb_build_object('full_name', 'Cornery Mangulu', 'role', 'legal_officer'),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    )
    ON CONFLICT (email) DO NOTHING;

    -- Upsert into user_profiles (in case trigger did not fire or needs role set)
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        role,
        initials,
        is_active,
        created_at,
        updated_at
    )
    SELECT
        au.id,
        'cmangulu@gmail.com',
        'Cornery Mangulu',
        'legal_officer',
        'CM',
        true,
        now(),
        now()
    FROM auth.users au
    WHERE au.email = 'cmangulu@gmail.com'
    ON CONFLICT (id) DO UPDATE
        SET full_name = 'Cornery Mangulu',
            role = 'legal_officer',
            initials = 'CM',
            is_active = true,
            updated_at = now();

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'User seed failed: %', SQLERRM;
END $$;
