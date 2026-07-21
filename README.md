# FitTrack

FitTrack is a health and fitness activity tracker built with Node.js, Express, EJS and MySQL. Registered users can log workouts, view personal totals, search their activity history, filter quick sessions, and edit or delete their own records.

## Features

- Public home and about pages
- Registration and bcrypt password hashing
- Session-based authentication and role-based administrator pages
- Create, read, update and delete workout records
- Database search across exercise names, categories and notes
- Dashboard totals calculated with SQL aggregate queries
- Quick-workout filtering for sessions of 30 minutes or less
- Parameterised SQL queries, server-side validation and EJS output escaping
- Login-attempt auditing
- Responsive interface

## Installation

1. Install Node.js and MySQL.
2. From MySQL, run `create_db.sql` and then `insert_test_data.sql`.
3. Copy `.env.example` to `.env` and update values only if your MySQL settings differ.
4. Run `npm install`.
5. Run `node index.js`.
6. Open `http://localhost:8000`.

A sample administrator account is included:

- Username: `gold`
- Password: `smiths123ABC$`

By default, the application uses the `health` database, listens on port `8000`, and supports the following environment variables:

```text
HEALTH_HOST=localhost
HEALTH_USER=health_app
HEALTH_PASSWORD=qwertyuiop
HEALTH_DATABASE=health
HEALTH_BASE_PATH=http://localhost:8000
```

## Project structure

```text
index.js                 Express application and database connection
routes/main.js           Routes, validation, authentication and SQL queries
views/                   EJS user interface templates
public/main.css          Responsive visual design
create_db.sql            Complete MySQL data model
insert_test_data.sql     Sample administrator account and workouts
links.txt                Deployed application links
report.docx              Project documentation
```
