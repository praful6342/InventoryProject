// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

// Handle login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error(err);
            return res.render('login', { error: 'Database error' });
        }
        if (!user) {
            return res.render('login', { error: 'Invalid username or password' });
        }
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error(err);
                return res.render('login', { error: 'Login error' });
            }
            if (result) {
                req.session.user = { id: user.id, username: user.username, role: user.role };
                res.redirect('/');
            } else {
                res.render('login', { error: 'Invalid username or password' });
            }
        });
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/login');
    });
});

module.exports = router;
