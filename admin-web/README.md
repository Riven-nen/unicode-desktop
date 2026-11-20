# Unicode Lab Admin

A separate web console for account and class administration. It is deliberately
not part of the Electron app:

- Students and professors use the desktop app.
- Admins use this web app.

## Scope

- Sign in with an `admin` profile.
- Search and filter users.
- Promote/demote students, professors, and admins through `admin_set_role`.
- Generate professor invite codes with a lifespan and usage limit; copy or
  revoke them from the invite panel.
- Review classes, professors, join codes, student counts, and assignment counts.
- Never reads submissions or code.

Invite holders create/sign in to a desktop account and redeem the code from the
student dashboard. Redemption is handled by `redeem_professor_invite`; expired,
revoked, and used-up codes are rejected.

## Setup

Running `npm run dev` from the repository root starts the desktop app and this
console together. To run this project alone:

```bash
cd admin-web
cp .env.example .env
# fill in the same Supabase URL and publishable key as the desktop app
npm install
npm run dev
```

The dev server runs on <http://localhost:5174>.

Build for deployment:

```bash
npm run build
# static output in dist/ — deploy to Vercel, Netlify, or any static host
```

## Admin account

The seed creates:

- `admin@unicode.test` / `Password123!` (role `admin`)

For a real deployment, create an account normally and promote it once with the
service role:

```sql
update public.profiles
set role = 'admin'
where email = 'you@school.edu';
```

## Safety rules

- Admin RLS policies expose only profiles, classes, enrollments, and assignment
  metadata. Submissions, snapshots, paste events, and code are not readable by
  admins.
- Role changes go through the `admin_set_role` RPC. Admins cannot change their
  own role, the last admin cannot be demoted, and a professor with classes must
  have those classes reassigned or deleted before demotion.
- Professor invites are read-only for admins; creation and revocation go
  through guarded RPCs. Codes are never exposed to students or professors.
- The app uses the publishable key only. Never put the service-role key in this
  or any browser bundle.

## Password reset

The sign-in form can send a Supabase reset email. The reset page is handled by
your Supabase project's configured Site URL; this console does not host a
recovery page.
