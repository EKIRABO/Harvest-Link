# HarvestLink — Sprint 1

A working slice of the HarvestLink platform from your SRS: user registration/login for
all five roles, role-based access control, and produce listing management (create,
view, edit, mark sold, delete). Built with **Node.js + Express** on the backend,
**MySQL** for storage, and plain **HTML/CSS/JS** on the frontend — no framework, no
build step.

This covers FR 1.1–1.3 (accounts, login, roles), FR 2.1–2.3 (produce listings with photos),
and an early slice of FR 3 and FR 4 (transporters and storage providers can register their
availability, and everyone can browse it). Market demand, delivery requests/acceptance,
notifications, and admin reporting are still Sprint 2–4 and aren't built yet.

## Tech stack
- **Backend:** Node.js, Express, mysql2, bcryptjs (password hashing), jsonwebtoken (auth)
- **Database:** MySQL / MariaDB
- **Frontend:** Plain HTML/CSS/JS, talks to the backend via `fetch()`

## Project structure
```
harvestlink/
├── server.js              # Express entry point
├── config/db.js           # MySQL connection pool
├── middleware/auth.js     # JWT verification + role guard
├── routes/
│   ├── auth.js             # register, login
│   ├── produce.js          # produce listing CRUD + image upload
│   ├── storage.js          # storage facility registration + browsing
│   └── transport.js        # transporter availability registration + browsing
├── database/
│   ├── harvestlink.sql                          # full schema + 5 seed accounts (fresh installs)
│   └── migration_01_images_and_availability.sql # run this if you already imported harvestlink.sql
├── public/
│   ├── login.html          # login page
│   ├── register.html       # registration page
│   ├── dashboard.html      # role-adaptive dashboard
│   ├── uploads/produce/    # uploaded produce photos land here
│   ├── css/style.css
│   └── js/
│       ├── auth.js
│       └── dashboard.js
├── package.json
└── .env.example
```

## Setup

**1. Install MySQL/MariaDB and Node.js if you don't have them, then install dependencies:**
```bash
cd harvestlink
npm install
```

**2. Create the database:**
```bash
mysql -u root -p < database/harvestlink.sql
```
This creates `harvestlink_db` with all tables and 5 demo accounts (one per role),
all with the password `password123`.

**If you already imported the database before this update**, run the migration instead
of re-importing (it only adds the new columns/tables, it won't touch your existing data):
```bash
mysql -u root -p harvestlink_db < database/migration_01_images_and_availability.sql
```
(Or paste its contents into phpMyAdmin's SQL tab.)

**3. Create a dedicated database user** (don't use root in your app):
```sql
CREATE USER 'harvestlink_user'@'localhost' IDENTIFIED BY 'your_password_here';
GRANT ALL PRIVILEGES ON harvestlink_db.* TO 'harvestlink_user'@'localhost';
FLUSH PRIVILEGES;
```

**4. Configure environment variables:**
```bash
cp .env.example .env
```
Edit `.env` with your DB credentials and set `JWT_SECRET` to a long random string.

**5. Run the server:**
```bash
npm start
```
Visit `http://localhost:5000` in your browser.

## Demo accounts
All seeded with password `password123`:

| Role              | Email                          |
|-------------------|---------------------------------|
| Farmer            | alice.farmer@harvestlink.rw     |
| Transporter       | eric.transport@harvestlink.rw   |
| Storage provider  | josee.storage@harvestlink.rw    |
| Buyer             | jean.buyer@harvestlink.rw       |
| Admin             | admin@harvestlink.rw            |

## What each role sees right now
- **Farmer:** can post produce listings (with an optional photo), edit them, mark sold,
  delete, and see stats on their own listings. Can also browse registered storage
  facilities and transporters.
- **Storage provider:** can register/update their own facility (name, type, capacity,
  district, status), visible to everyone.
- **Transporter:** can register/update their vehicle and availability (type, capacity,
  district, status), visible to everyone.
- **Buyer / Admin:** can browse all available produce listings, storage facilities, and
  transporters (read-only — action features like requesting a specific delivery or
  reserving storage space come in Sprint 2–3).

## API endpoints
| Method | Endpoint                | Access          | Description |
|--------|--------------------------|-----------------|--------------|
| POST   | `/api/auth/register`     | Public          | Create an account (FR 1.1, 1.3) |
| POST   | `/api/auth/login`        | Public          | Log in, returns JWT (FR 1.2) |
| GET    | `/api/produce`           | Any logged-in role | View available listings (FR 2.3) |
| GET    | `/api/produce/mine`      | Farmer          | View own listings |
| POST   | `/api/produce`           | Farmer          | Create a listing, optional image upload (FR 2.1) |
| PUT    | `/api/produce/:id`       | Farmer (owner)  | Edit / update status / replace image (FR 2.2) |
| DELETE | `/api/produce/:id`       | Farmer (owner)  | Remove a listing + its image (FR 2.2) |
| GET    | `/api/storage`           | Any logged-in role | Browse storage facilities (FR 4.3) |
| GET    | `/api/storage/me`        | Storage provider | View own facility record |
| PUT    | `/api/storage/me`        | Storage provider | Register/update own facility (FR 4.1, 4.2) |
| GET    | `/api/transport`         | Any logged-in role | Browse registered transporters |
| GET    | `/api/transport/me`      | Transporter     | View own vehicle/availability record |
| PUT    | `/api/transport/me`      | Transporter     | Register/update own vehicle/availability |

Produce image uploads are sent as `multipart/form-data` (field name `image`), accept
JPG/PNG/WEBP up to 5MB, and are served back from `/uploads/produce/<filename>`.

## Tested
This was run end-to-end against a live MySQL instance before being handed to you:
registration and login for all 5 seed roles, listing creation with a real uploaded image
(file confirmed written to disk and served back), the "mark sold" JSON update confirmed
not broken by the image-upload middleware, storage facility registration, transporter
availability registration, cross-role browsing of all three (produce/storage/transport),
and role-based access rejection (a buyer attempting to POST a listing correctly gets a
403) — all verified working before this was handed to you.

## Next steps (Sprint 2–4 in your SRS)
- Delivery request/accept flow between farmers and transporters (FR 3.1–3.3)
- Reserving storage space, not just browsing it (part of FR 4)
- Market demand posting + user messaging (FR 5.1–5.3)
- Notifications (FR 6.1)
- Admin reporting dashboard (FR 7.1–7.2)

Happy to build any of these next — just say which one.
