# FoodBridge

A full-stack food donation platform. Donors list surplus food; NGOs browse, claim and collect it.

## Features
- Donor and NGO accounts with role-based authorization enforced on the backend
- Session-based authentication (bcrypt, httpOnly cookies, MySQL session store)
- Donors create, track and cancel donations
- NGOs search, filter and claim available donations
- Atomic claiming: two NGOs can never claim the same donation
- Full pickup address revealed only to the NGO that claims a donation
- Automated tests, including a concurrent-claim race test
- Dark mode, toasts, confirm dialogs and live expiry countdowns

## Tech stack
HTML, CSS, vanilla JavaScript | Node.js, Express | MySQL | REST + JSON

## Setup
1. Install Node.js 20+ and MySQL 8.
2. Create the database and tables:
   `mysql -u root -p -e "source database/schema.sql"`
3. Create a limited MySQL user (replace the password):
```sql
   CREATE USER 'foodbridge_app'@'localhost' IDENTIFIED BY 'your_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON foodbridge_db.* TO 'foodbridge_app'@'localhost';
```
4. `cd backend`, `npm install`, then copy `.env.example` to `.env` and fill it in.
5. `npm run dev`, then open http://localhost:3000/pages/index.html

## Tests
Create a `foodbridge_test` database from `schema.sql` and grant the app user access. Then, in PowerShell:
`$env:DB_NAME="foodbridge_test"; npm test`
The tests refuse to run unless the database name ends in `_test`.

## API summary
| Method | Path | Who |
|---|---|---|
| POST | /api/auth/register, /login, /logout | public |
| GET | /api/auth/me | logged in |
| POST | /api/donations | donor |
| GET | /api/donations/available | NGO |
| GET | /api/donations/mine | donor |
| GET | /api/donations/claimed | NGO |
| GET | /api/donations/:id | donor or NGO (view depends on role) |
| PATCH | /api/donations/:id/cancel | donor (owner) |
| PATCH | /api/donations/:id/claim | NGO |
| PATCH | /api/donations/:id/status | owner or claiming NGO (COLLECTED) |

## Security notes
Parameterized SQL, bcrypt (cost 12), httpOnly and SameSite cookies, session regeneration on login, helmet headers, login rate limiting, ownership checks inside SQL `WHERE` clauses, no admin self-registration.