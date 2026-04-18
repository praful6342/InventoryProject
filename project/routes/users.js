const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const { isAdmin } = require('../middleware/auth');

// GET /users - list all users (admin only)
router.get('/', isAdmin, (req, res) => {
    db.all('SELECT id, username, role FROM users ORDER BY username', (err, users) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        res.render('users/index', {
            users,
            error: null,
            success: req.query.success || null,
            currentUser: req.session.user
        });
    });
});

// POST /users/add - add a new user (admin only)
router.post('/add', isAdmin, (req, res) => {
    const { username, password, role } = req.body;

    // Validation
    if (!username || !password || !role) {
        return renderWithError('All fields are required');
    }

    if (!['admin', 'seller'].includes(role)) {
        return renderWithError('Invalid role selected');
    }

    if (password.length < 6) {
        return renderWithError('Password must be at least 6 characters');
    }

    const hashed = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
           [username.trim(), hashed, role],
           function(err) {
               if (err) {
                   if (err.message.includes('UNIQUE constraint failed')) {
                       return renderWithError('Username already exists');
                   }
                   console.error(err);
                   return renderWithError('Database error while adding user');
               }
               res.redirect('/users?success=User added successfully');
           }
    );

    // Helper to re-render the page with an error message
    function renderWithError(error) {
        db.all('SELECT id, username, role FROM users ORDER BY username', (err, users) => {
            res.render('users/index', {
                users,
                error,
                success: null,
                currentUser: req.session.user
            });
        });
    }
});

// POST /users/delete/:id - delete a user (admin only)
router.post('/delete/:id', isAdmin, (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const currentUserId = req.session.user.id;

    // Prevent self-deletion
    if (userId === currentUserId) {
        return res.redirect('/users?error=Cannot delete your own account');
    }

    // Fetch user to check role
    db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error(err);
            return res.redirect('/users?error=Database error');
        }
        if (!user) {
            return res.redirect('/users?error=User not found');
        }

        // If trying to delete an admin, ensure it's not the last admin
        if (user.role === 'admin') {
            db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"', (err, row) => {
                if (err) {
                    console.error(err);
                    return res.redirect('/users?error=Database error');
                }
                if (row.count <= 1) {
                    return res.redirect('/users?error=Cannot delete the last admin account');
                }
                performDelete();
            });
        } else {
            performDelete();
        }
    });

    function performDelete() {
        db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
            if (err) {
                console.error(err);
                return res.redirect('/users?error=Database error while deleting user');
            }
            res.redirect('/users?success=User deleted successfully');
        });
    }
});

module.exports = router;
