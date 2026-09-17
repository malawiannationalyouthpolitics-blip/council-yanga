-- ============================================================================
-- Council Yanga — Supabase Seed Data (Likoma District CDF & Initiatives)
-- Migration / Seed File: supabase/seed.sql
-- ============================================================================

-- ============ MONITORS ============
insert into monitors (id, name, phone, email, wards, status, join_date, last_active) values
  ('M001', 'James Phiri', '+265 888 123 456', 'j.phiri@councilyanga.mw', 'Chizumulu North Ward', 'Active', '2026-01-15', '2026-08-28 10:00:00+00'),
  ('M002', 'Grace Banda', '+265 999 234 567', 'g.banda@councilyanga.mw', 'Chizumulu South Ward', 'Active', '2026-01-15', '2026-08-27 14:30:00+00'),
  ('M003', 'Stella Mkandawire', '+265 888 345 678', 's.mkandawire@councilyanga.mw', 'Likoma North Ward', 'Active', '2025-12-01', '2026-08-28 11:20:00+00'),
  ('M004', 'Peter Kachingwe', '+265 999 456 789', 'p.kachingwe@councilyanga.mw', 'Likoma South Ward', 'Active', '2026-08-20', '2026-08-25 15:45:00+00')
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  email = excluded.email,
  wards = excluded.wards,
  status = excluded.status;

-- ============ PROJECTS & INITIATIVES ============
insert into projects (
  id, name, initiative_name, initiative_component, item_type, project_type, component,
  region, district, beneficiary_type, description, objectives, sector, constituency, ward,
  traditional_authority, location, gps_lat, gps_lng, beneficiaries, budget, disbursed, funds_used,
  funding_source, approval_date, start_date, expected_completion, actual_completion, status, progress,
  implementing_dept, contractor, monitor_id, monitor_name, created_at, updated_at
) values
(
  'CY-2026-001', 'Chiteko–Mocho Road Rehabilitation', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'District-Wide',
  'Rehabilitation of the 8 km Chiteko–Mocho feeder road connecting Chizumulu North communities, including culvert installation and gravelling to ensure year-round access.',
  'Restore all-season road access between Chiteko and Mocho villages, improve market and health-service connectivity for Chizumulu North residents.',
  'Roads and Bridges', 'Likoma Island', 'Chizumulu North Ward', 'T/A Mwakhwere', 'Chiteko–Mocho, Chizumulu Island',
  -11.965, 34.578, 1800, 3500000, 2275000, 2275000,
  'CDF 2025/2026', '2026-01-15', '2026-02-10', '2026-08-31', null, 'Ongoing', 65,
  'Department of Roads', 'Chizumulu Roads Contractors', 'M001', 'James Phiri', '2026-01-10', '2026-08-20'
),
(
  'CY-2026-002', 'Chiteko FP 3-Classroom Block', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Students',
  'Construction of a 3-classroom block at Chiteko Full Primary School to address severe overcrowding and improve learning conditions for pupils in Chizumulu North.',
  'Reduce classroom overcrowding, improve learning environment and increase enrolment capacity at Chiteko FP.',
  'Education', 'Likoma Island', 'Chizumulu North Ward', 'T/A Mwakhwere', 'Chiteko Village, Chizumulu Island',
  -11.968, 34.582, 920, 2800000, 2800000, 2800000,
  'CDF 2025/2026', '2025-10-20', '2025-11-15', '2026-03-31', '2026-04-05', 'Completed', 100,
  'Ministry of Education', 'Island Build Group', 'M001', 'James Phiri', '2025-10-15', '2026-04-08'
),
(
  'CY-2026-003', 'Chiteko Bridge Reconstruction', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Sports, creative arts & Innovation',
  'Reconstruction of the Chiteko Bridge with reinforced concrete to replace the deteriorating wooden structure, ensuring year-round safe crossing for community members.',
  'Provide a safe, durable crossing on the Chiteko–Mocho route, prevent seasonal isolation of Chiteko sub-villages during rains.',
  'Roads and Bridges', 'Likoma Island', 'Chizumulu North Ward', 'T/A Mwakhwere', 'Chiteko Stream Crossing, Chizumulu Island',
  -11.972, 34.575, 1200, 2200000, 1430000, 1430000,
  'CDF 2025/2026', '2026-02-01', '2026-03-10', '2026-09-30', null, 'Ongoing', 45,
  'Department of Roads', 'Lakeside Construction Ltd', 'M001', 'James Phiri', '2026-01-28', '2026-08-22'
),
(
  'CY-2026-004', 'Chizumulu Solar Plant Capacity Expansion', null, null, 'Project', 'Other Projects/Initiative', 'District-Wide Project',
  'Northern', 'Likoma', 'District-Wide',
  'Installation of 50 kW additional solar PV generation capacity and battery storage at the Chizumulu mini-grid power station to eliminate frequent power outages.',
  'Provide reliable 24-hour electricity for Chizumulu North and South communities, support local businesses, cold storage and social facilities.',
  'Energy and Electricity', 'Likoma Island', 'Chizumulu North Ward', 'T/A Mwakhwere', 'Chizumulu Power Station Site',
  -11.963, 34.585, 4500, 4800000, 3120000, 3120000,
  'ESCOM / CDF Partnership', '2026-01-10', '2026-03-01', '2026-11-30', null, 'Ongoing', 30,
  'ESCOM / Ministry of Energy', 'Solar Power Malawi Ltd', 'M001', 'James Phiri', '2026-01-05', '2026-08-15'
),
(
  'CY-2026-005', 'Same–Bama Road Improvement', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'District-Wide',
  'Gravelling and drainage improvement along 6 km of the Same–Bama road in Chizumulu South, providing all-weather connectivity to the health centre and harbour.',
  'Improve vehicular and bicycle access across Chizumulu South, reduce travel time to essential social services and Same port.',
  'Roads and Bridges', 'Likoma Island', 'Chizumulu South Ward', 'T/A Mwakhwere', 'Same–Bama Corridor, Chizumulu Island',
  -11.998, 34.572, 2200, 3100000, 2790000, 2790000,
  'CDF 2025/2026', '2025-12-10', '2026-01-20', '2026-07-31', null, 'Near Completion', 85,
  'Department of Roads', 'Chizumulu Roads Contractors', 'M002', 'Grace Banda', '2025-12-05', '2026-08-25'
),
(
  'CY-2026-006', 'Mocho JP Classroom Extension', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Students',
  'Construction of a 2-classroom extension and a new teacher''s house at Mocho Junior Primary School serving children in the southern part of Chizumulu Island.',
  'Expand classroom capacity at Mocho JP, improve teacher retention through improved housing, raise enrolment and completion rates.',
  'Education', 'Likoma Island', 'Chizumulu South Ward', 'T/A Mwakhwere', 'Mocho Village, Chizumulu Island',
  -12.003, 34.568, 680, 1800000, 1170000, 1170000,
  'CDF 2025/2026', '2026-02-15', '2026-03-20', '2026-10-31', null, 'Ongoing', 40,
  'Ministry of Education', 'Island Build Group', 'M002', 'Grace Banda', '2026-02-10', '2026-08-20'
),
(
  'CY-2026-007', 'Mocho Irrigation Canal Rehabilitation', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Youth Entrepreneurs',
  'Rehabilitation of the Mocho irrigation canal system to restore irrigated farming capacity for smallholder farmers in Chizumulu South.',
  'Restore functional irrigation to 120 farming households, increase food production, support ADMARC market linkages.',
  'Agriculture & Environment', 'Likoma Island', 'Chizumulu South Ward', 'T/A Mwakhwere', 'Mocho Irrigation Site, Chizumulu Island',
  -12.005, 34.580, 850, 2400000, 0, 0,
  'CDF 2025/2026', '2026-04-10', null, '2026-12-31', null, 'Not Started', 0,
  'Ministry of Agriculture', 'Pending Tender', 'M002', 'Grace Banda', '2026-04-05', '2026-08-05'
),
(
  'CY-2026-008', 'Chizumulu Health Centre Renovation', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Women Entrepreneurs',
  'Renovation and extension of Chizumulu Health Centre including a new maternity wing, improved consultation rooms and a pharmacy store serving both Chizumulu wards.',
  'Improve maternal health outcomes, expand outpatient capacity and reduce referrals to mainland hospitals from Chizumulu Island.',
  'Health and Nutrition', 'Likoma Island', 'Chizumulu South Ward', 'T/A Mwakhwere', 'Chizumulu Health Centre, Chizumulu Island',
  -11.995, 34.565, 3200, 3200000, 2080000, 2080000,
  'CDF 2025/2026', '2026-01-25', '2026-02-28', '2026-10-31', null, 'Ongoing', 50,
  'Ministry of Health', 'Lakeside Construction Ltd', 'M002', 'Grace Banda', '2026-01-20', '2026-08-22'
),
(
  'CY-2026-009', 'Makulawe–Nkhwazi Road Rehabilitation', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Sports, creative arts & Innovation',
  'Rehabilitation of the Makulawe–Nkhwazi road including the Makulawe–Yofu spur, providing improved access to schools, the health centre and ADMARC from northern Likoma Island.',
  'Restore all-weather road access across Likoma North, reduce isolation of Makulawe and Yofu communities, improve market connectivity.',
  'Roads and Bridges', 'Likoma Island', 'Likoma North Ward', 'T/A Mkumpha', 'Makulawe–Nkhwazi Corridor, Likoma Island',
  -12.062, 34.728, 2100, 3100000, 2015000, 2015000,
  'CDF 2025/2026', '2026-01-20', '2026-02-25', '2026-09-30', null, 'Ongoing', 55,
  'Department of Roads', 'Likoma Infrastructure Co.', 'M003', 'Stella Mkandawire', '2026-01-15', '2026-08-28'
),
(
  'CY-2026-010', 'Yofu FP 4-Classroom Block', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Students',
  'Construction of a 4-classroom block with headteacher''s office and staff room at Yofu Full Primary School, replacing temporary mud-brick classrooms.',
  'Eliminate open-air and substandard classrooms at Yofu FP, provide modern learning spaces for 1,140 learners in Likoma North.',
  'Education', 'Likoma Island', 'Likoma North Ward', 'T/A Mkumpha', 'Yofu Village, Likoma Island',
  -12.055, 34.735, 1140, 3400000, 3400000, 3400000,
  'CDF 2025/2026', '2025-09-15', '2025-10-10', '2026-04-30', '2026-05-02', 'Completed', 100,
  'Ministry of Education', 'Northern Lakeside Builders', 'M003', 'Stella Mkandawire', '2025-09-10', '2026-05-05'
),
(
  'CY-2026-011', 'Kachere Irrigation Scheme Rehabilitation', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'District-Wide',
  'Rehabilitation of intake structures and distribution channels at the Kachere irrigation scheme to enable year-round vegetable and maize production.',
  'Increase irrigated agricultural output for Likoma North farmers, improve food security and diversify community nutrition on Likoma Island.',
  'Agriculture & Environment', 'Likoma Island', 'Likoma North Ward', 'T/A Mkumpha', 'Kachere Farming Area, Likoma Island',
  -12.070, 34.720, 950, 2000000, 400000, 100000,
  'CDF 2025/2026', '2026-03-01', null, '2026-11-30', null, 'Approved', 0,
  'Ministry of Agriculture', 'Pending Tender', 'M003', 'Stella Mkandawire', '2026-02-25', '2026-08-10'
),
(
  'CY-2026-012', 'Likoma Solar Plant Capacity Upgrade', null, null, 'Project', 'Other Projects/Initiative', 'District-Wide Project',
  'Northern', 'Likoma', 'District-Wide',
  'Grid modernization and 75 kW solar array expansion at the main Likoma Island mini-grid station, connecting additional households and public institutions.',
  'Increase electricity supply reliability, connect Likoma hospital and 3 health clinics to continuous power, reduce fuel costs for backup generators.',
  'Energy and Electricity', 'Likoma Island', 'Likoma North Ward', 'T/A Mkumpha', 'Mbamba Mini-Grid Station, Likoma Island',
  -12.050, 34.730, 6200, 5200000, 3380000, 3380000,
  'ESCOM / CDF Partnership', '2026-01-05', '2026-02-15', '2026-10-31', null, 'Ongoing', 60,
  'Ministry of Energy', 'Solar Power Malawi Ltd', 'M003', 'Stella Mkandawire', '2026-01-02', '2026-08-18'
),
(
  'CY-2026-013', 'St Peters–Khuyu Road Rehabilitation', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'District-Wide',
  'Upgrading and culvert construction along the 7 km St Peters–Khuyu road linking the southern communities of Likoma Island to the main district hospital and jetty.',
  'Ensure uninterrupted emergency access to St Peter''s Hospital from Likoma South, improve fisheries transport to Mbamba jetty.',
  'Roads and Bridges', 'Likoma Island', 'Likoma South Ward', 'T/A Mkumpha', 'St Peters–Khuyu Corridor, Likoma Island',
  -12.085, 34.738, 2800, 3300000, 2310000, 2310000,
  'CDF 2025/2026', '2026-02-10', '2026-03-15', '2026-09-30', null, 'Ongoing', 70,
  'Department of Roads', 'Likoma Infrastructure Co.', 'M004', 'Peter Kachingwe', '2026-02-05', '2026-08-25'
),
(
  'CY-2026-014', 'Nkhwazi FP 4-Classroom Block', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'Students',
  'Construction of a 4-classroom block with twin VIP latrines and desks at Nkhwazi Full Primary School, Likoma South.',
  'Improve educational infrastructure at Nkhwazi FP, eliminate double-shifting of classes and provide dignified sanitation for learners and teachers.',
  'Education', 'Likoma Island', 'Likoma South Ward', 'T/A Mkumpha', 'Nkhwazi Village, Likoma Island',
  -12.095, 34.745, 980, 3200000, 3200000, 3200000,
  'CDF 2025/2026', '2025-11-20', '2025-12-15', '2026-05-31', '2026-06-01', 'Completed', 100,
  'Ministry of Education', 'Northern Lakeside Builders', 'M004', 'Peter Kachingwe', '2025-11-15', '2026-06-03'
),
(
  'CY-2026-015', 'Likoma Fisheries Processing Facility', null, null, 'Project', 'Other Projects/Initiative', 'Community Development Project',
  'Northern', 'Likoma', 'Women Entrepreneurs',
  'Construction of a community fish processing and cold storage facility for the Likoma South Fishermen Cooperative, with ice plant and solar-powered refrigeration.',
  'Reduce post-harvest fish losses, improve fish quality for mainland markets, increase fishermen household incomes, support the Fisheries Office mandate.',
  'Commercial Services', 'Likoma Island', 'Likoma South Ward', 'T/A Mkumpha', 'Khuyu Beach, Likoma Island',
  -12.108, 34.740, 1600, 3000000, 1950000, 1950000,
  'CDF 2025/2026', '2026-03-25', '2026-05-01', '2026-12-31', null, 'Ongoing', 35,
  'Department of Fisheries', 'Lakeside Construction Ltd', 'M004', 'Peter Kachingwe', '2026-03-20', '2026-08-22'
),
(
  'CY-2026-016', 'St Peter''s Hospital Maternity Wing', null, null, 'Project', 'CDF', 'Community Development Project',
  'Northern', 'Likoma', 'District-Wide',
  'Construction of a dedicated 20-bed maternity wing at St Peter''s Hospital, Likoma Island, to improve maternal and neonatal health services for the entire constituency.',
  'Improve maternal health outcomes, reduce maternal mortality, provide adequate delivery and post-natal care facilities for Likoma District.',
  'Health and Nutrition', 'Likoma Island', 'Likoma South Ward', 'T/A Mkumpha', 'St Peter''s Hospital, Likoma Island',
  -12.090, 34.742, 8500, 6500000, 1300000, 325000,
  'CDF 2025/2026', '2026-06-10', null, '2027-06-30', null, 'Assessed', 0,
  'Ministry of Health', 'Pending Tender', 'M004', 'Peter Kachingwe', '2026-06-05', '2026-08-12'
),
(
  'CY-INIT-001', 'Likoma Youth Enterprise Seed Capital Fund', 'Likoma Youth Enterprise Seed Capital Fund', 'Youth Enterprise fund', 'Initiative', 'CDF', 'Youth Enterprise fund',
  'Northern', 'Likoma', 'Youth Entrepreneurs',
  'Revolving seed capital funding, start-up toolkits and entrepreneurship training empowering youth to establish and manage sustainable micro-enterprises and cooperatives across wards.',
  'Empower 180 youth entrepreneurs with seed business capital, tools and mentorship to create sustainable island businesses.',
  'Commercial Services', 'Likoma Island', 'Likoma North Ward', 'T/A Mkumpha', 'Mbamba & Makulawe, Likoma Island',
  -12.052, 34.733, 180, 4500000, 2925000, 2925000,
  'CDF 2025/2026', '2026-02-01', '2026-02-15', '2026-11-30', null, 'Ongoing', 60,
  'Department of Youth and Sports', 'Likoma Youth Development Coalition', 'M004', 'Peter Kachingwe', '2026-02-01', '2026-08-20'
),
(
  'CY-INIT-002', 'Likoma Secondary School Bursaries Scheme', 'Likoma Secondary School Bursaries Scheme', 'School Bursaries', 'Initiative', 'CDF', 'School Bursaries',
  'Northern', 'Likoma', 'Students',
  'Comprehensive education bursary support covering tuition fees, examination registration, school uniforms and learning materials for vulnerable students attending secondary and tertiary institutions.',
  'Support 320 vulnerable students across Likoma and Chizumulu with full secondary education bursaries to ensure zero dropouts.',
  'Education', 'Likoma Island', 'Likoma South Ward', 'T/A Mkumpha', 'St Peter''s Secondary & Community Day Secondary Schools',
  -12.088, 34.740, 320, 6000000, 4500000, 4500000,
  'CDF 2025/2026', '2026-01-10', '2026-01-20', '2026-12-15', null, 'Ongoing', 75,
  'District Education Office', 'Likoma District Education Desk', 'M004', 'Peter Kachingwe', '2026-01-10', '2026-08-25'
)
on conflict (id) do update set
  name = excluded.name,
  progress = excluded.progress,
  status = excluded.status,
  budget = excluded.budget,
  disbursed = excluded.disbursed,
  funds_used = excluded.funds_used,
  updated_at = now();

-- ============ SCHEDULED VISITS ============
insert into scheduled_visits (id, project_id, project_name, monitor_id, monitor_name, visit_date, visit_time, ward, notes, status, acknowledged_at, scheduled_by, scheduled_at) values
  ('V-015', 'CY-2026-001', 'Chiteko–Mocho Road Rehabilitation', 'M001', 'James Phiri', '2026-09-05', '08:00', 'Chizumulu North Ward', 'Inspect km 5–8. Verify drainage culverts and gravel compaction quality.', 'Upcoming', null, null, '2026-08-25'),
  ('V-014', 'CY-2026-003', 'Chiteko Bridge Reconstruction', 'M001', 'James Phiri', '2026-09-10', '10:00', 'Chizumulu North Ward', 'Inspect reinforcement work and verify concrete mix quality at bridge deck.', 'Acknowledged', '2026-08-26 09:30:00+00', null, '2026-08-24'),
  ('V-013', 'CY-2026-004', 'Chizumulu Solar Plant Capacity Expansion', 'M001', 'James Phiri', '2026-08-15', '09:00', 'Chizumulu North Ward', 'Verify panel installation progress and battery room setup.', 'Completed', '2026-08-12 08:00:00+00', null, '2026-08-10'),
  ('V-012', 'CY-2026-001', 'Chiteko–Mocho Road Rehabilitation', 'M001', 'James Phiri', '2026-08-20', '08:30', 'Chizumulu North Ward', 'Monthly progress inspection - km 3–5.', 'Completed', '2026-08-17 09:00:00+00', null, '2026-08-15'),
  ('V-011', 'CY-2026-002', 'Chiteko FP 3-Classroom Block', 'M001', 'James Phiri', '2026-08-01', '11:00', 'Chizumulu North Ward', 'Final completion handover inspection.', 'Missed', null, null, '2026-07-28'),
  ('V-016', 'CY-2026-005', 'Same–Bama Road Improvement', 'M002', 'Grace Banda', '2026-09-08', '09:00', 'Chizumulu South Ward', 'Final gravelling inspection and drainage sign-off.', 'Upcoming', null, null, '2026-08-28'),
  ('V-017', 'CY-2026-006', 'Mocho JP Classroom Extension', 'M002', 'Grace Banda', '2026-08-25', '14:00', 'Chizumulu South Ward', 'Progress check - roofing and window-frame status.', 'Completed', '2026-08-23 10:00:00+00', null, '2026-08-20'),
  ('V-018', 'CY-2026-009', 'Makulawe–Nkhwazi Road Rehabilitation', 'M003', 'Stella Mkandawire', '2026-09-12', '08:00', 'Likoma North Ward', 'Quality inspection of gravelling works - bring engineer report.', 'Upcoming', null, null, '2026-08-29'),
  ('V-019', 'CY-2026-015', 'Likoma Fisheries Processing Facility', 'M004', 'Peter Kachingwe', '2026-09-03', '10:00', 'Likoma South Ward', 'Initial site visit - foundation and cold-room construction verification.', 'Upcoming', null, null, '2026-08-28'),
  ('V-020', 'CY-2026-016', 'St Peter''s Hospital Maternity Wing', 'M004', 'Peter Kachingwe', '2026-08-05', '09:00', 'Likoma South Ward', 'Pre-assessment site verification for maternity wing construction.', 'Missed', null, null, '2026-08-01')
on conflict (id) do nothing;

-- ============ MONITOR SUBMISSIONS ============
insert into monitor_submissions (
  id, project_id, project_name, monitor_id, monitor_name, submitted_at, progress, status,
  observation, milestone, photo_count, gps_lat, gps_lng, funds_used_reported, admin_note, reviewed_at
) values
(
  'SUB-012', 'CY-2026-001', 'Chiteko–Mocho Road Rehabilitation', 'M001', 'James Phiri', '2026-08-20 10:00:00+00', 65, 'Approved',
  'Road works on km 3–5 progressing well. Gravel compaction complete on this section. Workers and equipment operational six days a week.',
  'Gravelling of km 5–8 by 31 Aug 2026', 5, -11.965, 34.578, 3500000, null, '2026-08-22 09:00:00+00'
),
(
  'SUB-011', 'CY-2026-003', 'Chiteko Bridge Reconstruction', 'M001', 'James Phiri', '2026-08-22 11:30:00+00', 45, 'Pending Review',
  'Abutment works are complete and formwork for the bridge deck is being assembled. Reinforcement bars delivered but community raised quality concerns.',
  'Bridge deck pour by 10 Sep 2026', 4, -11.972, 34.575, 2200000, null, null
),
(
  'SUB-010', 'CY-2026-004', 'Chizumulu Solar Plant Capacity Expansion', 'M001', 'James Phiri', '2026-08-15 08:45:00+00', 30, 'Approved',
  'Additional solar panels installed on the south array. Battery bank expansion in progress. New inverter room foundation laid.',
  'Battery bank installation by 20 Sep 2026', 6, -11.963, 34.585, 4800000, null, '2026-08-17 14:00:00+00'
),
(
  'SUB-009', 'CY-2026-001', 'Chiteko–Mocho Road Rehabilitation', 'M001', 'James Phiri', '2026-08-01 09:15:00+00', 50, 'Returned',
  'Works ongoing on km 3–5. Some sections need re-grading after rain damage.',
  '', 2, -11.965, 34.578, null, null, '2026-08-03 10:00:00+00'
),
(
  'SUB-008', 'CY-2026-005', 'Same–Bama Road Improvement', 'M002', 'Grace Banda', '2026-08-25 15:00:00+00', 85, 'Pending Review',
  'Gravelling 90% complete on the Same–Bama corridor. Drainage structures all installed. Final section near Bama village being finished.',
  'Final gravelling and sign-off by 30 Sep', 7, -11.998, 34.572, 3100000, null, null
),
(
  'SUB-007', 'CY-2026-008', 'Chizumulu Health Centre Renovation', 'M002', 'Grace Banda', '2026-08-10 13:20:00+00', 50, 'Approved',
  'Maternity wing structure complete up to lintel level. Pharmacy store walls finished. Roofing materials on site ready for installation.',
  'Roofing complete by 20 Sep 2026', 8, -11.995, 34.565, 1950000, null, '2026-08-12 11:30:00+00'
),
(
  'SUB-006', 'CY-2026-009', 'Makulawe–Nkhwazi Road Rehabilitation', 'M003', 'Stella Mkandawire', '2026-08-28 11:00:00+00', 55, 'Pending Review',
  'Gravelling of Makulawe–Yofu spur completed. Main Makulawe–Nkhwazi section at 50%. Culvert at stream crossing installed successfully.',
  'Main road gravelling completion by 30 Sep', 8, -12.062, 34.728, 2750000, null, null
)
on conflict (id) do nothing;

-- ============ FEEDBACK ============
insert into feedback (id, project_id, project_name_snapshot, type, citizen_name, contact, submitted_at, message, status, response, resolved_at) values
  ('FB-001', 'CY-2026-001', 'Chiteko–Mocho Road Rehabilitation', 'Progress Observation', 'A. Mwale', '+265 888 001 001', '2026-08-25 09:00:00+00', 'Works on the Chiteko–Mocho road appear to have stalled for two weeks near the bridge approach. No workers or equipment visible at the section closest to the stream.', 'Under Review', '', null),
  ('FB-002', 'CY-2026-002', 'Chiteko FP 3-Classroom Block', 'Project Information Correction', 'B. Nkhoma', '+265 999 002 002', '2026-08-22 14:20:00+00', 'The portal shows 2 classrooms were built but all 3 classrooms are clearly complete and in use. Please update the record for accuracy.', 'Resolved', 'Thank you for the correction. The portal has been updated to reflect all 3 classrooms. This was a data entry error which has been corrected.', '2026-08-24 10:00:00+00'),
  ('FB-003', 'CY-2026-007', 'Mocho Irrigation Canal Rehabilitation', 'Request for Information', 'C. Chirwa', '+265 888 003 003', '2026-08-20 08:30:00+00', 'When will the Mocho irrigation canal project begin? Farmers have been waiting and the planting season is approaching. No communication from the Council or contractor.', 'Under Review', '', null),
  ('FB-004', null, 'General', 'Community Suggestion', 'D. Phiri', '', '2026-08-18 16:45:00+00', 'Likoma South has no safe water point near Mbungo village. We request a borehole project similar to what was done on the mainland in the next CDF cycle for Likoma District.', 'Received', '', null),
  ('FB-005', 'CY-2026-008', 'Chizumulu Health Centre Renovation', 'Location Correction', 'E. Banda', '+265 999 005 005', '2026-08-15 11:10:00+00', 'The GPS coordinates on the portal place the health centre in the wrong part of Chizumulu Island. The actual clinic is about 150 metres further south of the marked point.', 'Resolved', 'GPS coordinates have been verified and updated. A monitor confirmed the correct location. Thank you for the accurate report.', '2026-08-17 09:00:00+00')
on conflict (id) do nothing;

-- ============ ANNOUNCEMENTS ============
insert into announcements (id, title, category, body, published, created_at) values
  ('AN-001', '16 CDF Projects Approved for Likoma District 2025/2026', 'New Projects', 'The Council has approved 16 development projects for Likoma District Constituency for the 2025/2026 CDF year, totalling MK 52.5 million. Projects span all four wards - Chizumulu North, Chizumulu South, Likoma North and Likoma South - covering education, health, roads, agriculture and energy. Full project details are now available on the Council Yanga portal.', true, '2026-08-01 08:00:00+00'),
  ('AN-002', 'Yofu FP 4-Classroom Block Successfully Completed', 'Project Completion', 'The 4-classroom block at Yofu Full Primary School has been successfully completed and officially handed over in Likoma North. The facility will benefit 1,140 learners starting Term 2, 2026. The Council thanks the community, implementing team and monitor for their diligence.', true, '2026-05-05 09:00:00+00'),
  ('AN-003', 'CDF Community Progress Meeting - Chizumulu North Ward', 'Community Meeting', 'The Council will hold a public community meeting on Saturday 6th September 2026 at 09:00 at Chiteko ADMARC Hall. The agenda includes CDF project progress reports for all Chizumulu North projects. Community members, project beneficiaries, civil society organisations and media are invited to attend.', true, '2026-09-05 10:00:00+00'),
  ('AN-004', 'Public Notice: Tender for Kachere Irrigation Scheme', 'CDF Notice', 'Sealed bids are invited from registered contractors for the rehabilitation of the Kachere Irrigation Scheme, Likoma North. Tender documents and technical specifications are available at the Likoma District Council offices during business hours. Closing date: 30 September 2026 at 12:00 noon.', true, '2026-08-10 12:00:00+00'),
  ('AN-005', 'Nkhwazi FP School Block Completed Ahead of Schedule', 'Project Completion', 'The 4-classroom block at Nkhwazi Full Primary School, Likoma South, has been completed two weeks ahead of schedule. The facility benefits approximately 980 learners. The Council commends the contractor''s efficient delivery and the Likoma South community''s cooperation.', true, '2026-06-03 14:00:00+00'),
  ('AN-006', 'Same–Bama Road Improvement - 85% Complete', 'Progress Update', 'The Same–Bama road improvement project, Chizumulu South, is progressing excellently at 85% completion. Gravelling is nearly complete and drainage structures are all installed. Completion is expected by end of September 2026. The Chizumulu South community is commended for their support.', true, '2026-08-25 10:00:00+00')
on conflict (id) do nothing;

-- ============ SYSTEM NOTIFICATIONS ============
insert into sys_notifications (id, for_role, monitor_id, type, title, message, read, visit_id, submission_id, project_id, created_at) values
  ('SN-001', 'admin', 'M001', 'acknowledgement', 'Visit Acknowledged', 'James Phiri acknowledged the scheduled visit to Chiteko Bridge Reconstruction on 10 Sep 2026.', false, 'V-014', null, 'CY-2026-003', '2026-08-26 09:30:00+00'),
  ('SN-002', 'admin', 'M001', 'missed_visit', 'Missed Visit Alert', 'James Phiri missed the scheduled visit to Chiteko FP 3-Classroom Block (01 Aug 2026). Follow up required.', false, 'V-011', null, 'CY-2026-002', '2026-08-02 08:00:00+00'),
  ('SN-003', 'admin', 'M001', 'submission', 'New Report Submitted', 'James Phiri submitted a field report for Chiteko Bridge Reconstruction (45% progress). Awaiting review.', false, null, 'SUB-011', 'CY-2026-003', '2026-08-22 11:30:00+00'),
  ('SN-004', 'admin', 'M002', 'submission', 'New Report Submitted', 'Grace Banda submitted a field report for Same–Bama Road Improvement (85% progress). Awaiting review.', true, null, 'SUB-008', 'CY-2026-005', '2026-08-25 15:00:00+00'),
  ('SN-005', 'admin', 'M003', 'submission', 'New Report Submitted', 'Stella Mkandawire submitted a field report for Makulawe–Nkhwazi Road Rehabilitation (55% progress). Awaiting review.', false, null, 'SUB-006', 'CY-2026-009', '2026-08-28 11:00:00+00'),
  ('SN-007', 'monitor', 'M001', 'visit_scheduled', 'New Visit Scheduled', 'Admin scheduled a site visit to Chiteko–Mocho Road Rehabilitation on 05 Sep 2026 at 08:00. Please acknowledge.', false, 'V-015', null, 'CY-2026-001', '2026-08-25 08:00:00+00'),
  ('SN-008', 'monitor', 'M001', 'submission_approved', 'Report Approved', 'Your field report SUB-012 for Chiteko–Mocho Road Rehabilitation has been approved. Good work!', true, null, 'SUB-012', 'CY-2026-001', '2026-08-22 09:00:00+00'),
  ('SN-009', 'monitor', 'M001', 'submission_returned', 'Report Returned for Correction', 'Your field report SUB-009 for Chiteko–Mocho Road Rehabilitation was returned. Please add more photos and resubmit.', true, null, 'SUB-009', 'CY-2026-001', '2026-08-03 10:00:00+00')
on conflict (id) do nothing;

-- ============ APP NOTIFICATIONS ============
insert into app_notifications (id, title, message, type, project_id, created_at) values
  ('N-001', 'Same–Bama Road Now 85% Complete', 'Works on the Same–Bama road in Chizumulu South have reached 85% with final gravelling underway.', 'update', 'CY-2026-005', '2026-08-25 10:00:00+00'),
  ('N-002', 'Yofu FP Classrooms Commissioned', 'Yofu Full Primary School classroom block has been handed over and is now in use for learners.', 'completion', 'CY-2026-010', '2026-05-05 09:00:00+00'),
  ('N-003', 'Chizumulu Community Meeting Saturday', 'Join the CDF ward progress review this Saturday at Chiteko ADMARC Hall from 09:00.', 'meeting', null, '2026-09-01 08:00:00+00')
on conflict (id) do nothing;

-- ============ FINANCIAL SETTINGS ============
insert into financial_settings (id, cdf_year, total_allocation, total_approved, total_disbursed, total_expenditure, source, last_updated)
values (true, '2025/2026', 52500000, 52500000, 42000000, 36500000, 'National Budget / CDF Allocation', current_date)
on conflict (id) do update set
  cdf_year = excluded.cdf_year,
  total_allocation = excluded.total_allocation,
  total_approved = excluded.total_approved,
  total_disbursed = excluded.total_disbursed,
  total_expenditure = excluded.total_expenditure;
