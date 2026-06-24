-- ============================================================================
-- OpenRide Ride-Sharing Platform
-- Migration 002: Seed Data for Development
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Fixed UUIDs for referential integrity in seed data
-- --------------------------------------------------------------------------

-- Passenger users
-- passenger1: Alice Johnson   = a1000000-0000-0000-0000-000000000001
-- passenger2: Bob Williams    = a1000000-0000-0000-0000-000000000002
-- passenger3: Carol Davis     = a1000000-0000-0000-0000-000000000003

-- Driver users
-- driver1: Dave Martinez      = d2000000-0000-0000-0000-000000000001
-- driver2: Eve Thompson       = d2000000-0000-0000-0000-000000000002
-- driver3: Frank Garcia       = d2000000-0000-0000-0000-000000000003

-- Driver profiles
-- profile1 (Dave)             = d0300000-0000-0000-0000-000000000001
-- profile2 (Eve)              = d0300000-0000-0000-0000-000000000002
-- profile3 (Frank)            = d0300000-0000-0000-0000-000000000003

-- Rides
-- ride1                       = a4000000-0000-0000-0000-000000000001
-- ride2                       = a4000000-0000-0000-0000-000000000002
-- ride3                       = a4000000-0000-0000-0000-000000000003
-- ride4                       = a4000000-0000-0000-0000-000000000004
-- ride5                       = a4000000-0000-0000-0000-000000000005

-- Governance proposal
-- proposal1                   = 60500000-0000-0000-0000-000000000001

-- --------------------------------------------------------------------------
-- 1. Passenger Users
-- Password for all users: 'password123'
-- bcrypt hash: $2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi
-- --------------------------------------------------------------------------

INSERT INTO users (id, email, phone, password_hash, first_name, last_name, role, is_verified, is_active, rating_avg, rating_count, created_at, updated_at)
VALUES
    (
        'a1000000-0000-0000-0000-000000000001',
        'alice@example.com',
        '+14155550101',
        '$2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi',
        'Alice',
        'Johnson',
        'passenger',
        true,
        true,
        4.85,
        12,
        '2025-09-01 10:00:00+00',
        '2025-12-15 08:30:00+00'
    ),
    (
        'a1000000-0000-0000-0000-000000000002',
        'bob@example.com',
        '+14155550102',
        '$2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi',
        'Bob',
        'Williams',
        'passenger',
        true,
        true,
        4.70,
        8,
        '2025-09-15 14:00:00+00',
        '2025-12-20 11:00:00+00'
    ),
    (
        'a1000000-0000-0000-0000-000000000003',
        'carol@example.com',
        '+14155550103',
        '$2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi',
        'Carol',
        'Davis',
        'passenger',
        true,
        true,
        4.92,
        5,
        '2025-10-01 09:00:00+00',
        '2025-12-22 16:45:00+00'
    );

-- --------------------------------------------------------------------------
-- 2. Driver Users
-- --------------------------------------------------------------------------

INSERT INTO users (id, email, phone, password_hash, first_name, last_name, role, is_verified, is_active, rating_avg, rating_count, created_at, updated_at)
VALUES
    (
        'd2000000-0000-0000-0000-000000000001',
        'dave@example.com',
        '+14155550201',
        '$2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi',
        'Dave',
        'Martinez',
        'driver',
        true,
        true,
        4.90,
        45,
        '2025-08-15 08:00:00+00',
        '2025-12-28 19:00:00+00'
    ),
    (
        'd2000000-0000-0000-0000-000000000002',
        'eve@example.com',
        '+14155550202',
        '$2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi',
        'Eve',
        'Thompson',
        'driver',
        true,
        true,
        4.78,
        32,
        '2025-08-20 11:00:00+00',
        '2025-12-27 14:30:00+00'
    ),
    (
        'd2000000-0000-0000-0000-000000000003',
        'frank@example.com',
        '+14155550203',
        '$2a$10$rqBlxPefIAAnIBnS51DwqeZxrz8PxLR/FvZlSMUesT/YZqfVp0pmi',
        'Frank',
        'Garcia',
        'driver',
        true,
        true,
        4.95,
        28,
        '2025-09-01 07:00:00+00',
        '2025-12-29 10:15:00+00'
    );

-- --------------------------------------------------------------------------
-- 3. Driver Profiles with Vehicles
-- --------------------------------------------------------------------------

INSERT INTO driver_profiles (id, user_id, license_number, license_expiry, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate, vehicle_type, is_online, current_location, documents_verified, background_check_status, total_rides, total_earnings, max_pickup_distance_km, created_at)
VALUES
    (
        'd0300000-0000-0000-0000-000000000001',
        'd2000000-0000-0000-0000-000000000001',
        'DL-CA-2025-78901',
        '2027-06-15',
        'Toyota',
        'Camry',
        2023,
        'Silver',
        '7ABC123',
        'economy',
        true,
        ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,   -- San Francisco downtown
        true,
        'passed',
        145,
        8742.50,
        15,
        '2025-08-16 09:00:00+00'
    ),
    (
        'd0300000-0000-0000-0000-000000000002',
        'd2000000-0000-0000-0000-000000000002',
        'DL-CA-2024-45678',
        '2026-11-30',
        'Honda',
        'Accord',
        2022,
        'Black',
        '8XYZ789',
        'comfort',
        false,
        ST_SetSRID(ST_MakePoint(-122.4082, 37.7839), 4326)::geography,   -- Near Union Square
        true,
        'passed',
        98,
        6230.00,
        10,
        '2025-08-21 12:00:00+00'
    ),
    (
        'd0300000-0000-0000-0000-000000000003',
        'd2000000-0000-0000-0000-000000000003',
        'DL-CA-2025-12345',
        '2028-03-20',
        'Chevrolet',
        'Suburban',
        2024,
        'White',
        '9QRS456',
        'xl',
        true,
        ST_SetSRID(ST_MakePoint(-122.3950, 37.7900), 4326)::geography,   -- Near Financial District
        true,
        'passed',
        72,
        5480.75,
        12,
        '2025-09-02 08:00:00+00'
    );

-- --------------------------------------------------------------------------
-- 4. Driver Documents
-- --------------------------------------------------------------------------

INSERT INTO driver_documents (driver_id, document_type, file_url, status, expires_at, uploaded_at)
VALUES
    -- Dave's documents
    ('d0300000-0000-0000-0000-000000000001', 'license_front',        'https://storage.openride.dev/docs/dave_license_front.jpg',   'approved', '2027-06-15', '2025-08-16 09:10:00+00'),
    ('d0300000-0000-0000-0000-000000000001', 'license_back',         'https://storage.openride.dev/docs/dave_license_back.jpg',    'approved', '2027-06-15', '2025-08-16 09:11:00+00'),
    ('d0300000-0000-0000-0000-000000000001', 'vehicle_registration', 'https://storage.openride.dev/docs/dave_registration.pdf',    'approved', '2026-08-15', '2025-08-16 09:12:00+00'),
    ('d0300000-0000-0000-0000-000000000001', 'insurance',            'https://storage.openride.dev/docs/dave_insurance.pdf',       'approved', '2026-08-15', '2025-08-16 09:13:00+00'),
    ('d0300000-0000-0000-0000-000000000001', 'profile_photo',        'https://storage.openride.dev/docs/dave_photo.jpg',           'approved', NULL,         '2025-08-16 09:14:00+00'),

    -- Eve's documents
    ('d0300000-0000-0000-0000-000000000002', 'license_front',        'https://storage.openride.dev/docs/eve_license_front.jpg',    'approved', '2026-11-30', '2025-08-21 12:10:00+00'),
    ('d0300000-0000-0000-0000-000000000002', 'license_back',         'https://storage.openride.dev/docs/eve_license_back.jpg',     'approved', '2026-11-30', '2025-08-21 12:11:00+00'),
    ('d0300000-0000-0000-0000-000000000002', 'vehicle_registration', 'https://storage.openride.dev/docs/eve_registration.pdf',     'approved', '2026-08-20', '2025-08-21 12:12:00+00'),
    ('d0300000-0000-0000-0000-000000000002', 'insurance',            'https://storage.openride.dev/docs/eve_insurance.pdf',        'approved', '2026-08-20', '2025-08-21 12:13:00+00'),
    ('d0300000-0000-0000-0000-000000000002', 'profile_photo',        'https://storage.openride.dev/docs/eve_photo.jpg',            'approved', NULL,         '2025-08-21 12:14:00+00'),

    -- Frank's documents
    ('d0300000-0000-0000-0000-000000000003', 'license_front',        'https://storage.openride.dev/docs/frank_license_front.jpg',  'approved', '2028-03-20', '2025-09-02 08:10:00+00'),
    ('d0300000-0000-0000-0000-000000000003', 'license_back',         'https://storage.openride.dev/docs/frank_license_back.jpg',   'approved', '2028-03-20', '2025-09-02 08:11:00+00'),
    ('d0300000-0000-0000-0000-000000000003', 'vehicle_registration', 'https://storage.openride.dev/docs/frank_registration.pdf',   'approved', '2026-09-01', '2025-09-02 08:12:00+00'),
    ('d0300000-0000-0000-0000-000000000003', 'insurance',            'https://storage.openride.dev/docs/frank_insurance.pdf',      'approved', '2026-09-01', '2025-09-02 08:13:00+00'),
    ('d0300000-0000-0000-0000-000000000003', 'profile_photo',        'https://storage.openride.dev/docs/frank_photo.jpg',          'approved', NULL,         '2025-09-02 08:14:00+00');

-- --------------------------------------------------------------------------
-- 5. Completed Rides
-- --------------------------------------------------------------------------

-- Ride 1: Alice -> Dave, economy, completed
INSERT INTO rides (id, passenger_id, driver_id, status, pickup_location, pickup_address, dropoff_location, dropoff_address, estimated_distance_km, estimated_duration_min, actual_distance_km, actual_duration_min, fare_amount, platform_fee, driver_payout, surge_multiplier, vehicle_type, requested_at, matched_at, pickup_at, dropoff_at)
VALUES (
    'a4000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',  -- Alice
    'd2000000-0000-0000-0000-000000000001',  -- Dave
    'completed',
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,   -- SF Downtown
    '123 Market St, San Francisco, CA 94105',
    ST_SetSRID(ST_MakePoint(-122.4098, 37.7835), 4326)::geography,   -- Union Square
    '333 Post St, San Francisco, CA 94108',
    2.4,
    8,
    2.6,
    10,
    12.50,
    1.88,
    10.62,
    1.00,
    'economy',
    '2025-12-01 14:00:00+00',
    '2025-12-01 14:01:30+00',
    '2025-12-01 14:05:00+00',
    '2025-12-01 14:15:00+00'
);

-- Ride 2: Bob -> Eve, comfort, completed
INSERT INTO rides (id, passenger_id, driver_id, status, pickup_location, pickup_address, dropoff_location, dropoff_address, estimated_distance_km, estimated_duration_min, actual_distance_km, actual_duration_min, fare_amount, platform_fee, driver_payout, surge_multiplier, vehicle_type, requested_at, matched_at, pickup_at, dropoff_at)
VALUES (
    'a4000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',  -- Bob
    'd2000000-0000-0000-0000-000000000002',  -- Eve
    'completed',
    ST_SetSRID(ST_MakePoint(-122.4372, 37.7581), 4326)::geography,   -- Castro
    '450 Castro St, San Francisco, CA 94114',
    ST_SetSRID(ST_MakePoint(-122.3928, 37.7927), 4326)::geography,   -- Embarcadero
    '1 Ferry Building, San Francisco, CA 94111',
    5.8,
    18,
    6.1,
    22,
    28.75,
    4.31,
    24.44,
    1.00,
    'comfort',
    '2025-12-05 18:30:00+00',
    '2025-12-05 18:31:45+00',
    '2025-12-05 18:36:00+00',
    '2025-12-05 18:58:00+00'
);

-- Ride 3: Carol -> Frank, xl, completed
INSERT INTO rides (id, passenger_id, driver_id, status, pickup_location, pickup_address, dropoff_location, dropoff_address, estimated_distance_km, estimated_duration_min, actual_distance_km, actual_duration_min, fare_amount, platform_fee, driver_payout, surge_multiplier, vehicle_type, requested_at, matched_at, pickup_at, dropoff_at)
VALUES (
    'a4000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',  -- Carol
    'd2000000-0000-0000-0000-000000000003',  -- Frank
    'completed',
    ST_SetSRID(ST_MakePoint(-122.4862, 37.7694), 4326)::geography,   -- Golden Gate Park
    '501 Stanyan St, San Francisco, CA 94117',
    ST_SetSRID(ST_MakePoint(-122.4016, 37.7956), 4326)::geography,   -- Fishermans Wharf
    '2801 Leavenworth St, San Francisco, CA 94133',
    7.2,
    22,
    7.5,
    25,
    38.00,
    5.70,
    32.30,
    1.20,
    'xl',
    '2025-12-10 11:00:00+00',
    '2025-12-10 11:02:00+00',
    '2025-12-10 11:08:00+00',
    '2025-12-10 11:33:00+00'
);

-- Ride 4: Alice -> Eve, comfort, completed (Alice's second ride)
INSERT INTO rides (id, passenger_id, driver_id, status, pickup_location, pickup_address, dropoff_location, dropoff_address, estimated_distance_km, estimated_duration_min, actual_distance_km, actual_duration_min, fare_amount, platform_fee, driver_payout, surge_multiplier, vehicle_type, requested_at, matched_at, pickup_at, dropoff_at)
VALUES (
    'a4000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000001',  -- Alice
    'd2000000-0000-0000-0000-000000000002',  -- Eve
    'completed',
    ST_SetSRID(ST_MakePoint(-122.4098, 37.7835), 4326)::geography,   -- Union Square
    '333 Post St, San Francisco, CA 94108',
    ST_SetSRID(ST_MakePoint(-122.4474, 37.7654), 4326)::geography,   -- Haight-Ashbury
    '1500 Haight St, San Francisco, CA 94117',
    4.1,
    14,
    4.3,
    16,
    22.00,
    3.30,
    18.70,
    1.00,
    'comfort',
    '2025-12-15 09:00:00+00',
    '2025-12-15 09:01:15+00',
    '2025-12-15 09:05:00+00',
    '2025-12-15 09:21:00+00'
);

-- Ride 5: Bob -> Dave, economy, completed (Bob's second ride)
INSERT INTO rides (id, passenger_id, driver_id, status, pickup_location, pickup_address, dropoff_location, dropoff_address, estimated_distance_km, estimated_duration_min, actual_distance_km, actual_duration_min, fare_amount, platform_fee, driver_payout, surge_multiplier, vehicle_type, requested_at, matched_at, pickup_at, dropoff_at)
VALUES (
    'a4000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000002',  -- Bob
    'd2000000-0000-0000-0000-000000000001',  -- Dave
    'completed',
    ST_SetSRID(ST_MakePoint(-122.3928, 37.7927), 4326)::geography,   -- Embarcadero
    '1 Ferry Building, San Francisco, CA 94111',
    ST_SetSRID(ST_MakePoint(-122.4580, 37.7709), 4326)::geography,   -- UCSF area
    '505 Parnassus Ave, San Francisco, CA 94143',
    6.5,
    20,
    6.8,
    23,
    18.50,
    2.78,
    15.72,
    1.00,
    'economy',
    '2025-12-20 16:45:00+00',
    '2025-12-20 16:46:30+00',
    '2025-12-20 16:50:00+00',
    '2025-12-20 17:13:00+00'
);

-- --------------------------------------------------------------------------
-- 6. Payments for Completed Rides
-- --------------------------------------------------------------------------

INSERT INTO payments (ride_id, passenger_id, driver_id, amount, platform_fee, driver_payout, tip_amount, payment_method, stripe_payment_id, stripe_transfer_id, status, created_at)
VALUES
    (
        'a4000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000001',
        'd2000000-0000-0000-0000-000000000001',
        12.50, 1.88, 10.62, 2.00,
        'card',
        'pi_seed_001_alice_dave',
        'tr_seed_001_dave',
        'completed',
        '2025-12-01 14:15:30+00'
    ),
    (
        'a4000000-0000-0000-0000-000000000002',
        'a1000000-0000-0000-0000-000000000002',
        'd2000000-0000-0000-0000-000000000002',
        28.75, 4.31, 24.44, 5.00,
        'card',
        'pi_seed_002_bob_eve',
        'tr_seed_002_eve',
        'completed',
        '2025-12-05 18:58:30+00'
    ),
    (
        'a4000000-0000-0000-0000-000000000003',
        'a1000000-0000-0000-0000-000000000003',
        'd2000000-0000-0000-0000-000000000003',
        38.00, 5.70, 32.30, 4.00,
        'card',
        'pi_seed_003_carol_frank',
        'tr_seed_003_frank',
        'completed',
        '2025-12-10 11:33:30+00'
    ),
    (
        'a4000000-0000-0000-0000-000000000004',
        'a1000000-0000-0000-0000-000000000001',
        'd2000000-0000-0000-0000-000000000002',
        22.00, 3.30, 18.70, 3.00,
        'card',
        'pi_seed_004_alice_eve',
        'tr_seed_004_eve',
        'completed',
        '2025-12-15 09:21:30+00'
    ),
    (
        'a4000000-0000-0000-0000-000000000005',
        'a1000000-0000-0000-0000-000000000002',
        'd2000000-0000-0000-0000-000000000001',
        18.50, 2.78, 15.72, 0.00,
        'card',
        'pi_seed_005_bob_dave',
        'tr_seed_005_dave',
        'completed',
        '2025-12-20 17:13:30+00'
    );

-- --------------------------------------------------------------------------
-- 7. Payment Methods
-- --------------------------------------------------------------------------

INSERT INTO payment_methods (user_id, stripe_payment_method_id, card_brand, card_last4, is_default, created_at)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'pm_seed_alice_visa',      'visa',       '4242', true,  '2025-09-01 10:30:00+00'),
    ('a1000000-0000-0000-0000-000000000002', 'pm_seed_bob_mastercard',  'mastercard', '5555', true,  '2025-09-15 14:30:00+00'),
    ('a1000000-0000-0000-0000-000000000003', 'pm_seed_carol_amex',      'amex',       '3782', true,  '2025-10-01 09:30:00+00');

-- --------------------------------------------------------------------------
-- 8. Ratings for Completed Rides
-- --------------------------------------------------------------------------

INSERT INTO ratings (ride_id, rater_id, rated_id, score, comment, created_at)
VALUES
    -- Ride 1: Alice rates Dave, Dave rates Alice
    ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 5, 'Great driver, very professional and quick pickup!', '2025-12-01 14:20:00+00'),
    ('a4000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 5, 'Friendly passenger, ready on time.', '2025-12-01 14:22:00+00'),

    -- Ride 2: Bob rates Eve, Eve rates Bob
    ('a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 4, 'Nice car and smooth ride. Took a slightly longer route.', '2025-12-05 19:05:00+00'),
    ('a4000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 5, 'Polite and easy-going passenger.', '2025-12-05 19:10:00+00'),

    -- Ride 3: Carol rates Frank, Frank rates Carol
    ('a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000003', 5, 'Spacious vehicle, perfect for our group. Excellent driver!', '2025-12-10 11:40:00+00'),
    ('a4000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 5, 'Wonderful group, very respectful of the vehicle.', '2025-12-10 11:45:00+00'),

    -- Ride 4: Alice rates Eve, Eve rates Alice
    ('a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 5, 'Another great ride! Love using OpenRide.', '2025-12-15 09:30:00+00'),
    ('a4000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 5, 'One of the best passengers. Always pleasant!', '2025-12-15 09:35:00+00'),

    -- Ride 5: Bob rates Dave, Dave rates Bob
    ('a4000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', 5, 'Fast and safe. Will ride again.', '2025-12-20 17:20:00+00'),
    ('a4000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 4, 'Good passenger, slightly late to pickup.', '2025-12-20 17:25:00+00');

-- --------------------------------------------------------------------------
-- 9. Governance Proposal
-- --------------------------------------------------------------------------

INSERT INTO governance_proposals (id, author_id, title, description, category, status, votes_for, votes_against, quorum_needed, voting_ends_at, created_at)
VALUES (
    '60500000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',   -- Dave authored the proposal
    'Reduce platform fee from 15% to 12% for drivers with 100+ rides',
    'As a community-owned platform, we should reward loyal drivers who have completed over 100 rides. '
    'This proposal suggests reducing the platform fee from 15% to 12% for these experienced drivers. '
    'This would incentivize driver retention and reward those who have contributed the most to our cooperative. '
    'Based on current financials, this would reduce platform revenue by approximately $2,400/quarter '
    'but improve driver satisfaction and retention significantly.',
    'pricing',
    'active',
    4,
    1,
    3,   -- quorum of 3 votes needed
    '2026-01-15 00:00:00+00',
    '2025-12-20 10:00:00+00'
);

-- --------------------------------------------------------------------------
-- 10. Votes on the Governance Proposal
-- --------------------------------------------------------------------------

INSERT INTO votes (proposal_id, user_id, vote, created_at)
VALUES
    ('60500000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'for',     '2025-12-20 10:05:00+00'),
    ('60500000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'for',     '2025-12-20 14:30:00+00'),
    ('60500000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'for',     '2025-12-21 08:00:00+00'),
    ('60500000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'for',     '2025-12-21 12:00:00+00'),
    ('60500000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000003', 'against', '2025-12-22 09:00:00+00');

-- --------------------------------------------------------------------------
-- 11. Platform Financials (Q4 2025: October - December)
-- --------------------------------------------------------------------------

INSERT INTO platform_financials (period_start, period_end, total_rides, total_fares, total_platform_fees, server_costs, payment_processing, insurance_costs, support_costs, surplus, redistributed, created_at)
VALUES (
    '2025-10-01',
    '2025-12-31',
    1247,            -- total rides in Q4
    43645.00,        -- total fares collected
    6546.75,         -- 15% platform fees
    1200.00,         -- server/infrastructure costs
    1309.35,         -- ~3% payment processing
    800.00,          -- insurance reserve
    450.00,          -- support staff costs
    2787.40,         -- surplus = fees - costs
    false,           -- not yet redistributed to community
    '2026-01-02 10:00:00+00'
);

-- --------------------------------------------------------------------------
-- 12. Emergency Contacts
-- --------------------------------------------------------------------------

INSERT INTO emergency_contacts (user_id, name, phone, relationship, created_at)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Mark Johnson',    '+14155550301', 'Spouse',  '2025-09-01 10:15:00+00'),
    ('a1000000-0000-0000-0000-000000000002', 'Sarah Williams',  '+14155550302', 'Sister',  '2025-09-15 14:15:00+00'),
    ('a1000000-0000-0000-0000-000000000003', 'Tom Davis',       '+14155550303', 'Father',  '2025-10-01 09:15:00+00'),
    ('d2000000-0000-0000-0000-000000000001', 'Maria Martinez',  '+14155550304', 'Wife',    '2025-08-15 08:15:00+00'),
    ('d2000000-0000-0000-0000-000000000002', 'James Thompson',  '+14155550305', 'Brother', '2025-08-20 11:15:00+00');

-- --------------------------------------------------------------------------
-- 13. Saved Places
-- --------------------------------------------------------------------------

INSERT INTO saved_places (user_id, label, address, location, created_at)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Home',   '742 Evergreen Terrace, San Francisco, CA 94110',   ST_SetSRID(ST_MakePoint(-122.4194, 37.7505), 4326)::geography, '2025-09-02 08:00:00+00'),
    ('a1000000-0000-0000-0000-000000000001', 'Work',   '555 California St, San Francisco, CA 94104',       ST_SetSRID(ST_MakePoint(-122.4038, 37.7924), 4326)::geography, '2025-09-02 08:01:00+00'),
    ('a1000000-0000-0000-0000-000000000002', 'Home',   '1234 Valencia St, San Francisco, CA 94110',        ST_SetSRID(ST_MakePoint(-122.4209, 37.7530), 4326)::geography, '2025-09-16 09:00:00+00'),
    ('a1000000-0000-0000-0000-000000000002', 'Gym',    '2145 Market St, San Francisco, CA 94114',          ST_SetSRID(ST_MakePoint(-122.4302, 37.7668), 4326)::geography, '2025-09-16 09:01:00+00'),
    ('a1000000-0000-0000-0000-000000000003', 'Home',   '890 Pacific Ave, San Francisco, CA 94133',         ST_SetSRID(ST_MakePoint(-122.4102, 37.7983), 4326)::geography, '2025-10-02 07:00:00+00');

COMMIT;
