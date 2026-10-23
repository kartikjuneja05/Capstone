# YogKinetix

A personalized yoga app built with React and JavaScript, browser-based MediaPipe Pose Landmarker, and a Node.js/SQLite account backend.

## Run locally

Use Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The development command starts both the frontend and account service. Create an account to save your ROM assessment and practice history. If port 3001 is already occupied by another development instance, stop that instance first.

- `npm run build` builds the frontend.
- `npm test` checks measurements, personalization, routine filtering, countdowns, authentication and persistence. API tests need permission to open a temporary local port.
- `npm start` starts the account service. Production mode requires `NODE_ENV=production`, an HTTPS `APP_ORIGIN`, a built frontend and an HTTPS reverse proxy. `PORT` and `DATABASE_PATH` can be configured.

## Shared ROM assessment

The homepage offers one assessment for all six routines. Its five supplied movements are arm raise, wide stance, squat, forward fold and elbow bend. Front views capture both sides together; squat and fold repeat in left/right side views, giving seven steps and ten saved side measurements. Each step provides text, spoken instructions, a reference, camera positioning guidance, a preparation countdown and a stable three-second capture. Users stop at their comfortable limit and can skip movements.

The saved version-3 profile is reusable for 30 days. Retesting replaces the profile only after the new assessment is saved. Previous routine-specific profiles are not used as shared measurements; existing users need to take the new assessment. Their accounts and session history are preserved.

Relevant skipped/expired checks exclude dependent routine holds. Observed shoulder elevation and limb extension personalize matching numeric checks. Squat knee flexion supplies a knee-fold target. Wide stance measures projected thigh spread and helps screen the recognizable triangle stance. Standing folds screen forward-fold reach. These are approximate 2D movement measurements, not clinical ROM. A standing squat does not establish comfortable kneeling; standing folding does not measure seated reach, supine leg lifting, or prone extension. Untested directions, neck motion, spinal curvature, strength and balance are not inferred. Such poses retain textbook geometry/observable instructions and can be skipped during practice.

## Routine practice

Six routines cover concentration, relaxation, leg strength, neck strength, back/spine strength and abdominal strength. A routine summary shows its poses, side repetitions, estimated time and 10/15/20-second hold choice. Calibration is separate from the routine estimate. Camera setup, spoken instructions and corrections may add time.

Practice uses the shared profile without routine-specific tests. Each hold receives five seconds of preparation and a stable three-second recognition check. Recognition combines broad textbook shape rules with optional joint-feature comparison from compatible reference photos. This is a rule-based prototype, not a trained KNN classifier. Evaluation uses target-to-ideal intervals with measurement tolerances where supported; unspecified textbook angles stay unspecified. The timer advances only during recognized, visible alignment in range. Each completed/skipped hold is followed by 15 seconds of rest, then five seconds of preparation for the next hold. Session summaries are saved to the account.

Original photos from `yoga_poses.zip` are displayed. Where a photo differs from NCERT's variant, its caption directs users to the written textbook instructions; incompatible photo features do not gate recognition. Raw camera frames and landmark streams stay on the device. Internet access is initially needed for model/WASM downloads and fonts; camera use needs localhost or HTTPS. Speech uses the browser's speech synthesis.

## Project layout

| Folder | Purpose |
| --- | --- |
| `src/` | Frontend code and all code-related folders |
| `src/components/` | App screens and reusable components |
| `src/data/` | Textbook pose catalog and evaluation definitions |
| `src/shared/` | Profile validation shared with the backend |
| `src/server/` | Account API, SQLite persistence and private runtime storage |
| `src/scripts/` | Development launcher |
| `src/tests/` | Behavior and API tests |
| `src/tools/` | Angle extraction and methodology PDF generation scripts |
| `src/dist/` | Generated frontend build (ignored) |
| `assets/` | Images and SVG references used by the app |
| `documentation/` | Local personal explanations and paper documents (ignored) |
| `helpers/` | User-supplied reference materials such as screenshots and PDFs |

Run npm commands from the project root. Package manifests, Vite configuration and the HTML entry point stay there. Installed dependencies and repository/tool metadata also remain at the root.

Public and teammate-facing documents live at the root. Reserve `documentation/` for requested personal explanations and paper documents that are not uploaded to GitHub.

The paper describes the earlier calibration design. Its generator is now `src/tools/build_methodology.py` and writes to `documentation/paper/`.

## Persistence and limitations

Passwords use salted scrypt hashes; account sessions use random server tokens, hashed in SQLite, with HttpOnly/SameSite cookies. Mutations check request origin. Profile/history queries enforce account ownership. The ignored database remains at `src/server/storage/still.sqlite` to preserve existing accounts; its historical filename and cookie name are internal compatibility details.

This is a local capstone backend. Password reset, email verification and deployment operations are not implemented. Keep the database out of source control, configure an exact production origin and deploy behind HTTPS.

Side views evaluate visible limbs only. Floor contact, face-up/down orientation, palm contact, breathing, pain and relaxation are not fully verifiable with these landmarks. Thresholds are provisional; real-camera validation is required before accuracy or clinical suitability claims.
