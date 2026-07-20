require('dotenv').config();

const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');

const app = express();
const port = 8000;

app.locals.formatDate = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value));
};

app.locals.formatDateTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London'
  }).format(new Date(value));
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fittrack-development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000
  }
}));

// The database settings use the environment variable names from the brief.
const db = mysql.createConnection({
  host: process.env.HEALTH_HOST || 'localhost',
  user: process.env.HEALTH_USER || 'health_app',
  password: process.env.HEALTH_PASSWORD || 'qwertyuiop',
  database: process.env.HEALTH_DATABASE || 'health'
});

global.db = db;

db.connect((error) => {
  if (error) {
    console.error('Database connection failed:', error.message);
    return;
  }

  console.log('Connected to the health database');
});

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.basePath = process.env.HEALTH_BASE_PATH || 'http://localhost:8000';
  next();
});

const mainRoutes = require('./routes/main');
app.use('/', mainRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    siteName: 'FitTrack',
    title: 'Page not found',
    message: 'The page you requested could not be found.'
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('error', {
    siteName: 'FitTrack',
    title: 'Something went wrong',
    message: 'The application could not complete that request. Please try again.'
  });
});

app.listen(port, () => {
  console.log(`FitTrack is listening on port ${port}`);
});
