# Graph Report - .  (2026-07-17)

## Corpus Check
- 348 files · ~281,988 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2368 nodes · 5134 edges · 236 communities (124 shown, 112 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Mobile Design-Doc Runtime
- Next.js App Shells & Config
- Web App Shell & Icons
- Mobile Local DB Layer
- Rate Limiting & Exam Grade API
- Teacher Assignment Grading API
- Exam Result Email Delivery
- Web Exam Runner UI
- Mobile Turnstile & UI Kit
- Teacher Settings & Consent
- Teacher Sign-Out & Icons
- Teacher Grading Review Pages
- Mobile Progress Screens
- Mobile Word-Bank Exercise
- Mobile Lernen Reference Screens
- Teacher Assignment Detail Page
- Teacher New Assignment Flow
- Shared Domain Types
- Teacher Class Detail Page
- Teacher Billing & Scheduled Jobs
- Web Admin Auth Pages
- Mobile Klasse (Class) Screens
- Admin App Build Config
- Teacher-Web Build Config
- Web App Build Config
- OTP Auth & Turnstile Verification
- Teacher Subscription (Abo) Page
- Teacher Dashboard & Schedule
- Web Cloze Exercise UI
- Teacher Zod Validation Schemas
- Mobile App Bootstrap & Session
- Web Home Browser & Pay Page
- Teacher Class Invite Modals
- Server Package Dependencies
- Mobile Icon Set
- Teacher Speaking Review UI
- Web Lernen Page & LLM Routes
- Admin Corpus & Role API
- Web Account & Avatar API
- Teacher Writing Review Release
- Web Lesson Player & Content
- Classes & Entitlements Migration
- Monorepo Root Package Config
- Dev Class Seed Script
- Core Package Build Config
- Server Package Build Config
- Types Package Build Config
- Mobile App Dependencies
- Teacher Speaking Submission API
- Teacher Exam Task Resolution
- Web App Dependencies
- Gamification Schema Migration
- Org Staffing Migration
- Mobile Expo App Config
- Mobile Auth & Login
- Mobile API Client
- Teacher-Web Login Page
- Exam Scoring Logic
- Teacher-Web Dependencies
- Web Reference Browser
- Teacher Org Staff Data Layer
- Admin App Dependencies
- Admin App Dev Dependencies
- Admin Auth Routes
- Mobile App Icon Config
- Teacher-Web Dev Dependencies
- Teacher Class Data Layer
- Web App Dev Dependencies
- Teacher Grading Criterion Bands UI
- Writing Review Migration
- Core Package Dependencies
- Mobile Package Metadata
- Mobile Exam Timer & Draft
- Teacher Schedule & Attendance Data
- Web App Package Metadata
- Web Theme Toggle
- Teacher Activation Migration
- Admin Oversight Data Layer
- Teacher Billing Portal (Polar)
- AI Exam Grading Prompt & Logic
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 114
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 123
- Community 124
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 207
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 215
- Community 216
- Community 217
- Community 218
- Community 219
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231

## God Nodes (most connected - your core abstractions)
1. `log()` - 76 edges
2. `useTheme()` - 74 edges
3. `newRequestId()` - 71 edges
4. `apiError()` - 66 edges
5. `supabaseService()` - 51 edges
6. `ok()` - 47 edges
7. `useSession()` - 37 edges
8. `sb()` - 33 edges
9. `supabaseServer()` - 33 edges
10. `enforce()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `WritingRecommendation` --references--> `ExamGrade`  [EXTRACTED]
  apps/teacher-web/src/lib/grade.ts → packages/types/src/index.ts
- `TaskDraft` --references--> `AufgabeNr`  [EXTRACTED]
  apps/web/src/components/admin/SimulationForm.tsx → packages/types/src/index.ts
- `Group` --references--> `RedemittelItem`  [EXTRACTED]
  apps/web/src/components/nachschlagen/ReferenceBrowser.tsx → packages/types/src/index.ts
- `guard()` --calls--> `apiError()`  [EXTRACTED]
  apps/admin/src/app/api/admin/corpus/[resource]/route.ts → packages/core/src/apiError.ts
- `handle()` --calls--> `apiError()`  [EXTRACTED]
  apps/admin/src/app/api/admin/corpus/[resource]/route.ts → packages/core/src/apiError.ts

## Import Cycles
- None detected.

## Communities (236 total, 112 thin omitted)

### Community 0 - "Mobile Design-Doc Runtime"
Cohesion: 0.08
Nodes (43): boot(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules(), createHelmetManager() (+35 more)

### Community 1 - "Next.js App Shells & Config"
Cohesion: 0.04
Nodes (33): nextConfig, metadata, nextConfig, metadata, mono, serif, ui, nextConfig (+25 more)

### Community 2 - "Web App Shell & Icons"
Cohesion: 0.05
Nodes (18): AppFooter(), IconApple(), IconCard(), IconChevronLeft(), IconClipboardCheck(), IconGooglePlay(), IconProps, IconSearch() (+10 more)

### Community 3 - "Mobile Local DB Layer"
Cohesion: 0.08
Nodes (46): AttemptResult, bumpActiveSeconds(), ExamTaskRow, findClassByCode(), getClassAssignments(), getClassLeaderboard(), getDailyMixToday(), getDraft() (+38 more)

### Community 4 - "Rate Limiting & Exam Grade API"
Cohesion: 0.09
Nodes (31): LimiterName, LimiterName, err(), POST(), SchreibenPage(), getExamTask(), getPublicSimulationIds(), getPublicSimulations() (+23 more)

### Community 5 - "Teacher Assignment Grading API"
Cohesion: 0.21
Nodes (34): AssignmentRow, POST(), SubmissionRow, GET(), AssignmentRow, POST(), POST(), POST() (+26 more)

### Community 6 - "Exam Result Email Delivery"
Cohesion: 0.07
Nodes (39): err(), POST(), badge(), bandChip(), bandColors(), buildSubject(), C, card() (+31 more)

### Community 7 - "Web Exam Runner UI"
Cohesion: 0.10
Nodes (34): DankePage(), IconCheck(), IconChevronRight(), ExamRunner(), BAND_COLOR, fmtPunkte(), isEmail(), Status (+26 more)

### Community 8 - "Mobile Turnstile & UI Kit"
Cohesion: 0.11
Nodes (35): CheckCircle(), FlameIcon(), TurnstileModal(), AccentButton(), AppText(), Card(), Center(), Chevron() (+27 more)

### Community 9 - "Teacher Settings & Consent"
Cohesion: 0.09
Nodes (25): EinstellungenPage(), loadConsentRoster(), StudentConsent, PortalButton(), AvvCard(), ConsentStatus, ConsentToggle(), ProfilForm() (+17 more)

### Community 10 - "Teacher Sign-Out & Icons"
Cohesion: 0.07
Nodes (32): SignOutButton(), IconCalendar(), IconCard(), IconChevronDown(), IconDashboard(), IconDotsV(), IconGrid(), IconLogout() (+24 more)

### Community 11 - "Teacher Grading Review Pages"
Cohesion: 0.12
Nodes (28): buildInitialBands(), ExamGradeLike, SchreibenReviewPage(), BAND_SET, extractAi(), isBand(), isKey(), SprechenReviewPage() (+20 more)

### Community 12 - "Mobile Progress Screens"
Cohesion: 0.14
Nodes (34): dedupeLatest(), fmt(), FortschrittScreen(), MODULE_LABEL, ProbeScreen(), SimRow, SimState, HomeScreen() (+26 more)

### Community 13 - "Mobile Word-Bank Exercise"
Cohesion: 0.14
Nodes (29): PlayIcon(), Frame, WordArrange(), arraysEqualLocal(), ExerciseItem(), ExercisePlayer(), Kind, norm() (+21 more)

### Community 14 - "Mobile Lernen Reference Screens"
Cohesion: 0.12
Nodes (31): SKILL_ICON, ListRow(), Loading(), NiveauChips(), LernenAreaScreen(), LernenCategoryScreen(), LernenScreen(), SKILL_COL (+23 more)

### Community 15 - "Teacher Assignment Detail Page"
Cohesion: 0.10
Nodes (28): AufgabeDetailPage(), STATUS, SubRow(), AufgabenPage(), Row(), colHead, ellipsis(), Filter (+20 more)

### Community 16 - "Teacher New Assignment Flow"
Cohesion: 0.08
Nodes (25): NeueAufgabePage(), BillingDonePage(), AufgabeActions(), CARD, INPUT, KlasseOpt, KorpusSim, KorpusTask (+17 more)

### Community 17 - "Shared Domain Types"
Cohesion: 0.06
Nodes (34): AufgabeNr, ExamResult, AppConfig, AssignmentKind, AssignmentSubmission, Class, ClassEnrollment, ClassLeaderboardEntry (+26 more)

### Community 18 - "Teacher Class Detail Page"
Cohesion: 0.10
Nodes (26): KlasseDetailPage(), ClassCard(), KlassenPage(), Action, AnwesenheitTab(), attendanceSummary(), AufgabenTab(), chipBtn (+18 more)

### Community 19 - "Teacher Billing & Scheduled Jobs"
Cohesion: 0.19
Nodes (19): POST(), recordEvent(), ClosedRow, POST(), EntRow, POST(), UsageRow, DueRow (+11 more)

### Community 20 - "Web Admin Auth Pages"
Cohesion: 0.10
Nodes (24): loginAction(), metadata, AdminPage(), logoutAction(), metadata, POST(), AdminHeader(), LINKS (+16 more)

### Community 21 - "Mobile Klasse (Class) Screens"
Cohesion: 0.12
Nodes (29): CRIT_LABEL, firstNameShort(), formatDueLong(), formatDueShort(), initialsOf(), KIND_LABEL, KlasseAufgabeScreen(), KlasseDashboard() (+21 more)

### Community 22 - "Admin App Build Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 23 - "Teacher-Web Build Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 24 - "Web App Build Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 25 - "OTP Auth & Turnstile Verification"
Cohesion: 0.16
Nodes (20): POST(), schema, SiteverifyResponse, turnstileEnabled(), verifyTurnstile(), POST(), schema, SiteverifyResponse (+12 more)

### Community 26 - "Teacher Subscription (Abo) Page"
Cohesion: 0.11
Nodes (17): AboPage(), fullDate(), monthLabel(), rowBaseline, statusLabel(), PaywallLauncher(), ProSuccess(), UpgradeButton() (+9 more)

### Community 27 - "Teacher Dashboard & Schedule"
Cohesion: 0.13
Nodes (19): DashboardPage(), greeting(), AnwesenheitPage(), IconChevronRight(), avvNeeded(), ClassCard, DashboardData, getDashboardData() (+11 more)

### Community 28 - "Web Cloze Exercise UI"
Cohesion: 0.16
Nodes (14): LevelBadge(), Phase, Pill, PillProps, Variant, useExerciseSensors(), FeedbackBar(), Phase (+6 more)

### Community 29 - "Teacher Zod Validation Schemas"
Cohesion: 0.08
Nodes (25): AcceptDpaInput, acceptDpaSchema, Band, bandEnum, CancelInput, cancelSchema, CheckoutInput, checkoutSchema (+17 more)

### Community 30 - "Mobile App Bootstrap & Session"
Cohesion: 0.14
Nodes (19): StatusBarThemed(), queryClient, Ctx, SessionCtx, SessionProvider(), Ctx, ThemeCtx, ThemeProvider() (+11 more)

### Community 31 - "Web Home Browser & Pay Page"
Cohesion: 0.11
Nodes (16): metadata, HomeBrowser(), MIN_FILTERS, SKILL_ICON, IconMic(), IconPencil(), IconSparkles(), PayForm() (+8 more)

### Community 32 - "Teacher Class Invite Modals"
Cohesion: 0.14
Nodes (16): IconCopy(), IconMail(), IconPlus(), ConfirmModal(), cancelBtn(), confirmBtn(), EinladenModal(), parseEmails() (+8 more)

### Community 33 - "Server Package Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, postgres, server-only, @supabase/supabase-js, @upstash/ratelimit, @upstash/redis, exports, ./db (+13 more)

### Community 34 - "Mobile Icon Set"
Cohesion: 0.18
Nodes (19): BackIcon(), base(), BulbIcon(), ChartIcon(), ClipboardIcon(), CloseIcon(), GearIcon(), GridIcon() (+11 more)

### Community 35 - "Teacher Speaking Review UI"
Cohesion: 0.11
Nodes (18): IconClock(), IconPause(), IconPlay(), backBtn, critPts(), draftBtn, kiChip, mmss() (+10 more)

### Community 36 - "Web Lernen Page & LLM Routes"
Cohesion: 0.19
Nodes (14): build(), FALLBACK, GET(), n(), Stats, metadata, NachschlagenPage(), HomePage() (+6 more)

### Community 37 - "Admin Corpus & Role API"
Cohesion: 0.22
Nodes (14): DELETE(), guard(), handle(), PATCH(), POST(), POST(), audit(), AuthCtx (+6 more)

### Community 38 - "Web Account & Avatar API"
Cohesion: 0.27
Nodes (11): POST(), GET(), GET(), POST(), schema, POST(), enforce(), looksLikeUnexpiredJwt() (+3 more)

### Community 39 - "Teacher Writing Review Release"
Cohesion: 0.16
Nodes (14): IconSend(), fmt(), FreigebenModal(), backBtn, draftBtn, kiChip, releaseBtn, releasedChip (+6 more)

### Community 40 - "Web Lesson Player & Content"
Cohesion: 0.16
Nodes (15): LessonPage(), IconArrowRight(), LessonPlayer(), FUNCTION_ORDER, FunctionGroup, getLessonItems(), getLessonMeta(), LEVEL_SORT() (+7 more)

### Community 41 - "Classes & Entitlements Migration"
Cohesion: 0.14
Nodes (11): assignment_submissions, assignments, asub_guard, class_join_attempts, entitlements, public.find_class_by_code(), public.has_active_teacher_sub(), public.is_assignment_teacher() (+3 more)

### Community 42 - "Monorepo Root Package Config"
Cohesion: 0.11
Nodes (18): allowScripts, sharp@0.34.5, devDependencies, turbo, turbo, name, packageManager, private (+10 more)

### Community 43 - "Dev Class Seed Script"
Cohesion: 0.17
Nodes (17): admin, CLASSMATES, __dirname, EMAIL_BASE, [emailLocal, emailDomain], ensureUser(), findUserByEmail(), loadEnv() (+9 more)

### Community 44 - "Core Package Build Config"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+9 more)

### Community 45 - "Server Package Build Config"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+9 more)

### Community 46 - "Types Package Build Config"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit (+9 more)

### Community 47 - "Mobile App Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, expo-audio, expo-blur, expo-screen-capture, react-native-screens, react-native-svg, @react-navigation/bottom-tabs, @supabase/supabase-js (+9 more)

### Community 48 - "Teacher Speaking Submission API"
Cohesion: 0.24
Nodes (13): SubRow, POST(), utcPeriod(), client(), deleteObject(), presignGet(), presignPut(), requireEnv() (+5 more)

### Community 49 - "Teacher Exam Task Resolution"
Cohesion: 0.15
Nodes (14): getExamTask(), TaskRow, toTask(), WritingAssignmentRow, CriterionEvaluation, EXAMINER_LABEL_DE, ExaminerLabel, Example (+6 more)

### Community 50 - "Web App Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, ai, @ai-sdk/groq, @dnd-kit/utilities, @marsidev/react-turnstile, postgres, @repo/types, @upstash/ratelimit (+9 more)

### Community 51 - "Gamification Schema Migration"
Cohesion: 0.19
Nodes (14): exam_points, exercise_progress, points_events, practice_sessions, public.complete_set(), public.record_speech_practice(), public.snapshot_readiness(), public.start_set() (+6 more)

### Community 52 - "Org Staffing Migration"
Cohesion: 0.23
Nodes (12): class_staff, classes, org_invites, org_members, organizations, public.app_teacher_can_read(), public.class_staff_assignee_ok(), public.class_sub_active() (+4 more)

### Community 53 - "Mobile Expo App Config"
Cohesion: 0.12
Nodes (15): projectId, expo, extra, icon, name, newArchEnabled, orientation, owner (+7 more)

### Community 54 - "Mobile Auth & Login"
Cohesion: 0.23
Nodes (13): LoginScreen(), AuthError, sendEmailOtp(), signInWithApple(), signInWithGoogle(), verifyEmailOtp(), env, googleConfigured() (+5 more)

### Community 55 - "Mobile API Client"
Cohesion: 0.24
Nodes (14): authedFetch(), authedLmsFetch(), doAuthedFetch(), getAvatarUrl(), GradeEvent, gradeStream(), LmsError, lmsThrow() (+6 more)

### Community 56 - "Teacher-Web Login Page"
Cohesion: 0.16
Nodes (12): INPUT_STYLE, LABEL_STYLE, LoginInner(), safeNext(), IconArrowRight(), BASE, Button(), Segmented() (+4 more)

### Community 57 - "Exam Scoring Logic"
Cohesion: 0.21
Nodes (15): BandPoints, BANDS, buildGrade(), criterionPoints(), nearestBand(), pointsFromBands(), pointsFromSpeakingBands(), RecomputedGrade (+7 more)

### Community 58 - "Teacher-Web Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @ai-sdk/groq, @aws-sdk/s3-request-presigner, next, postgres, react, resend, @upstash/ratelimit (+7 more)

### Community 59 - "Web Reference Browser"
Cohesion: 0.22
Nodes (13): build(), GET(), SKILL_ORDER, connectorKey(), firstTaskCode(), Group, groupByLabel(), MIN_FILTERS (+5 more)

### Community 61 - "Admin App Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @marsidev/react-turnstile, @repo/core, @repo/types, @supabase/ssr, @upstash/redis, zod, @marsidev/react-turnstile (+5 more)

### Community 62 - "Admin App Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript, tailwindcss (+5 more)

### Community 63 - "Admin Auth Routes"
Cohesion: 0.31
Nodes (9): GET(), safeNext(), POST(), isAdmin(), requireAdmin(), requireAuth(), roleOf(), getUser() (+1 more)

### Community 64 - "Mobile App Icon Config"
Cohesion: 0.15
Nodes (13): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+5 more)

### Community 65 - "Teacher-Web Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript, tailwindcss (+5 more)

### Community 67 - "Web App Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript, tailwindcss (+5 more)

### Community 68 - "Teacher Grading Criterion Bands UI"
Cohesion: 0.23
Nodes (10): BAND_DESC, BANDS, CriterionBands(), CritItem, fmt(), ptsColor(), SchreibenReviewData, RecomputedCriterion (+2 more)

### Community 69 - "Writing Review Migration"
Cohesion: 0.27
Nodes (10): assignment_ai_recommendations, assignment_grades, assignment_notify, assignment_submissions, assignments, public.is_submission_teacher(), public.submission_owner(), public.trg_assignment_notify() (+2 more)

### Community 70 - "Core Package Dependencies"
Cohesion: 0.17
Nodes (11): dependencies, @repo/types, zod, exports, @repo/types, zod, main, name (+3 more)

### Community 71 - "Mobile Package Metadata"
Cohesion: 0.18
Nodes (10): main, name, private, scripts, android, ios, start, typecheck (+2 more)

### Community 72 - "Mobile Exam Timer & Draft"
Cohesion: 0.38
Nodes (10): ExamScreen(), deleteDraft(), upsertDraft(), clearDeadline(), DEADLINE_KEY(), getActiveSim(), getDeadline(), setActiveSim() (+2 more)

### Community 74 - "Web App Package Metadata"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint:tokens, seed:class-dev, seed:export (+2 more)

### Community 75 - "Web Theme Toggle"
Cohesion: 0.35
Nodes (9): IconMoon(), IconSun(), ThemeToggle(), currentTheme(), setTheme(), setThemeColor(), Theme, THEME_COLOR (+1 more)

### Community 76 - "Teacher Activation Migration"
Cohesion: 0.27
Nodes (7): classes, enforce_class_cap, entitlements, public.is_class_locked(), public.teacher_active_student_count(), public.teacher_plan_of(), public.trg_enforce_class_cap()

### Community 77 - "Admin Oversight Data Layer"
Cohesion: 0.27
Nodes (8): oversight, listEntitlements(), listOrganizations(), OVERSIGHT_TABLES, oversightList(), OversightQuery, OversightTable, recentAuditLog()

### Community 78 - "Teacher Billing Portal (Polar)"
Cohesion: 0.31
Nodes (8): createCheckoutUrl(), createPortalUrl(), EntitlementPatch, mapPolarEvent(), planForProduct(), polarClient(), PolarWebhookEvent, productIdFor()

### Community 79 - "AI Exam Grading Prompt & Logic"
Cohesion: 0.29
Nodes (8): gradeWith(), gradeWritingVierAugen(), WritingRecommendation, buildExamMessages(), ExaminerPersona, kalibrierung(), ROLLE, examGradeModelSchema

### Community 80 - "Community 80"
Cohesion: 0.31
Nodes (8): arr(), __dirname, jsonb(), main(), q(), ROOT, sql, upsert()

### Community 81 - "Community 81"
Cohesion: 0.24
Nodes (6): app_config, on_auth_user_created, profiles, public.handle_new_user(), public.set_updated_at(), trg_profiles_updated

### Community 82 - "Community 82"
Cohesion: 0.25
Nodes (5): ClassRow, escapeHtml(), getResend(), RESEND_FROM, RESEND_FROM_NAME

### Community 83 - "Community 83"
Cohesion: 0.25
Nodes (6): fieldStyle, labelStyle, assignmentsData, notificationsData, orgData, scheduleData

### Community 84 - "Community 84"
Cohesion: 0.22
Nodes (8): AttendanceContext, ClassScheduleGroup, Row, ScheduleOverview, ScheduleRule, SessionStatus, WD_LONG, WD_SHORT

### Community 85 - "Community 85"
Cohesion: 0.25
Nodes (8): daily_activity, exam_drafts, exam_result_daily, exam_results, exercise_attempts, exercise_progress, public.trg_exam_result_daily(), trg_exam_drafts_updated

### Community 86 - "Community 86"
Cohesion: 0.25
Nodes (7): name, private, scripts, build, dev, start, version

### Community 87 - "Community 87"
Cohesion: 0.39
Nodes (4): LoginInner(), safeNext(), authedFetch(), supabaseBrowser()

### Community 89 - "Community 89"
Cohesion: 0.25
Nodes (7): name, private, scripts, build, dev, start, version

### Community 90 - "Community 90"
Cohesion: 0.43
Nodes (6): daily_mix_runs, exercise_progress, public.complete_set(), public.snapshot_readiness(), public.start_set(), v_readiness

### Community 91 - "Community 91"
Cohesion: 0.29
Nodes (3): auth.users, storage.buckets, storage.objects

### Community 92 - "Community 92"
Cohesion: 0.29
Nodes (7): ios, ITSAppUsesNonExemptEncryption, NSMicrophoneUsageDescription, NSSpeechRecognitionUsageDescription, bundleIdentifier, infoPlist, supportsTablet

### Community 93 - "Community 93"
Cohesion: 0.29
Nodes (7): devDependencies, @types/base-64, @types/react, typescript, @types/react, typescript, @types/base-64

### Community 94 - "Community 94"
Cohesion: 0.38
Nodes (5): AttendanceRoster(), LocalRow, OPTS, AttendanceStatus, RosterEntry

### Community 95 - "Community 95"
Cohesion: 0.38
Nodes (5): __dirname, main(), readInput(), ROOT, sql

### Community 96 - "Community 96"
Cohesion: 0.38
Nodes (5): __dirname, main(), readInput(), ROOT, sql

### Community 97 - "Community 97"
Cohesion: 0.67
Nodes (6): languages, redemittel, redemittel_item, redemittel_practice, redemittel_translation, v_translation_coverage

### Community 98 - "Community 98"
Cohesion: 0.48
Nodes (5): attendance, class_schedules, class_sessions, public.generate_sessions(), public.is_session_teacher()

### Community 99 - "Community 99"
Cohesion: 0.29
Nodes (6): exports, main, name, private, types, version

### Community 100 - "Community 100"
Cohesion: 0.80
Nodes (5): functions, redemittel, redemittel_item, skills, tasks

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (5): plugins, expo-apple-authentication, expo-font, expo-secure-store, expo-web-browser

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, monorepoRoot, path

### Community 104 - "Community 104"
Cohesion: 0.40
Nodes (4): Ctx, DEFAULT, FeatureFlagsProvider(), FeatureFlags

### Community 105 - "Community 105"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 107 - "Community 107"
Cohesion: 0.70
Nodes (4): public.speaking_submission_owner(), speaking_assignments, speaking_grades, speaking_submissions

### Community 108 - "Community 108"
Cohesion: 0.60
Nodes (3): class_invites, public.claim_invites(), public.teacher_pending_invite_count()

### Community 109 - "Community 109"
Cohesion: 0.60
Nodes (4): guardian_consents, public.guardian_consent_ok(), public.teacher_dpa_ok(), teacher_agreements

### Community 110 - "Community 110"
Cohesion: 0.40
Nodes (4): ApiErrorBody, ApiErrorCode, ApiErrorOptions, newRequestId()

### Community 111 - "Community 111"
Cohesion: 0.40
Nodes (4): criterionModelSchema, ExamGradeModel, KorrekturInput, korrekturSchema

## Knowledge Gaps
- **694 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+689 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **112 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `plugins` connect `Community 102` to `Mobile Expo App Config`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `expo` connect `Mobile Expo App Config` to `Mobile App Icon Config`, `Community 92`, `Community 102`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `nextConfig`, `name`, `version` to the rest of the system?**
  _694 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Mobile Design-Doc Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.07744107744107744 - nodes in this community are weakly interconnected._
- **Should `Next.js App Shells & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.044326241134751775 - nodes in this community are weakly interconnected._
- **Should `Web App Shell & Icons` be split into smaller, more focused modules?**
  _Cohesion score 0.054078014184397165 - nodes in this community are weakly interconnected._
- **Should `Mobile Local DB Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.07678075855689177 - nodes in this community are weakly interconnected._