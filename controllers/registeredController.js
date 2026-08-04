const Registered = require('../model/Registered');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const ROLES_LIST = require('../config/roles-list');
const transporter = require('../config/brevo');
const { employeeSanitization, handleValidationErrors } = require('../middleware/sanitization');

// Server-side password strength check (mirror frontend check)
const isStrongPassword = (pwd) => {
    const s = String(pwd || '');
    return s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);
};

// --- Presence (online/offline) config ---
const PRESENCE_STALE_MS = 40000;
const PRESENCE_SWEEP_INTERVAL_MS = 10000;

// Check if a username is already registered
const existsRegistered = async (req, res) => {
    const user = req.query.user || req.query.username || req.body?.user || req.body?.username;
    if (!user) return res.status(400).json({ message: 'username required as query param `user` or `username`' });
    try {
        const found = await Registered.findOne({ username: user }).lean().exec();
        return res.json({ exists: !!found });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getAllRegistereds = async (req, res) => {
    try {
        const list = await Registered.find().lean().exec();
        res.json(list.map(r => ({ ...r, _id: r._id })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const createNewRegistered = async (req, res) => {
    const { username, password, firstname, lastname, age, country, profilePicture } = req.body;
    if (!username || !password || !firstname || !lastname || !age || !country || !profilePicture) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        const exists = await Registered.findOne({ username }).exec();
        if (exists) return res.status(409).json({ message: 'Username already registered.' });
        const hashed = await bcrypt.hash(password, 10);
        const newReg = await Registered.create({
            UserId: crypto.randomUUID(),
            username,
            password: hashed,
            firstname,
            lastname,
            age,
            country,
            profilePicture,
            roles: { User: ROLES_LIST.User, Editor: 0, Admin: 0 }
        });
        res.status(201).json({ message: 'Registered created', id: newReg.UserId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to create registered.' });
    }
};

const updateRegistered = async (req, res) => {
    const id = req.params.userId || req.body.UserId || req.body.userId || req.body.username;
    if (!id) return res.status(400).json({ message: 'User identifier required (UserId or username).' });
    try {
        const filter = req.params.userId ? { UserId: req.params.userId } : (req.body.username ? { username: req.body.username } : { UserId: req.body.UserId });
        const update = { ...req.body };
        delete update.roles; // role changes are DB-only — never through this endpoint
        delete update.isOnline; // presence is only ever set by the heartbeat/offline endpoints
        delete update.lastActiveAt; // presence is only ever set by the heartbeat/offline endpoints

        // SECURITY: this endpoint has no ownership/auth check on the target
        // (anyone who knows a username/UserId can hit it), so it must never be
        // allowed to set a password directly - that would let anyone take over
        // any account with no verification at all. Password changes must go
        // through the code-verified reset flow instead
        // (requestPasswordReset -> verifyResetCode).
        if (update.password) {
            return res.status(400).json({ message: 'Password changes must go through the password reset flow.' });
        }

        const resu = await Registered.findOneAndUpdate(filter, update, { new: true }).exec();
        if (!resu) return res.status(404).json({ message: 'Registered not found.' });
        res.json({ message: 'Updated', registered: resu });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Update failed.' });
    }
};

const setAdminRole = async (req, res) => {
    const { userId } = req.params;
    const { makeAdmin } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required in params.' });
    if (typeof makeAdmin !== 'boolean') return res.status(400).json({ message: 'makeAdmin (boolean) required in body.' });
    try {
        const target = await Registered.findOne({ UserId: userId }).lean().exec();
        if (!target) return res.status(404).json({ message: 'Registered not found.' });

        if (makeAdmin === false && target.username === req.user) {
            return res.status(400).json({ message: 'You cannot remove your own admin access.' });
        }

        const nextRoles = makeAdmin
            ? { User: 0, Editor: 0, Admin: ROLES_LIST.Admin }
            : { User: ROLES_LIST.User, Editor: 0, Admin: 0 };

        await Registered.updateOne({ UserId: userId }, { $set: { roles: nextRoles } }).exec();

        res.json({
            message: makeAdmin ? 'Promoted to admin' : 'Demoted to user',
            roles: nextRoles,
            isAdmin: makeAdmin
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update role.' });
    }
};

const deleteRegistered = async (req, res) => {
    const id = req.body.UserId || req.body.username || req.query.userId || req.query.username;
    if (!id) return res.status(400).json({ message: 'User identifier required (UserId or username).' });
    try {
        const filter = req.body.username || req.query.username ? { username: req.body.username || req.query.username } : { UserId: req.body.UserId || req.query.userId };
        const del = await Registered.findOneAndDelete(filter).exec();
        if (!del) return res.status(404).json({ message: 'Registered not found.' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Delete failed.' });
    }
};

const getRegistered = async (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ message: 'userId required in params.' });
    try {
        const found = await Registered.findOne({ UserId: userId }).lean().exec();
        if (!found) return res.status(404).json({ message: 'Not found.' });
        res.json(found);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /registered/me: returns the LOGGED-IN user's own account data
// (used for the profile picture, display name, handle, age, and country in
// the header/account dropdown). Scoped to req.user (from the verified JWT),
// never to a client-supplied id. Sensitive fields are explicitly excluded -
// unlike getRegistered above, this never leaks the password hash, refresh
// token, or password-reset fields to the browser.
const getMyRegistered = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        const found = await Registered.findOne({ username: req.user })
            .select('-password -refreshToken -resetVerificationCode -resetVerificationExpires')
            .lean()
            .exec();
        if (!found) return res.status(404).json({ message: 'Not found.' });
        res.json(found);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /registered/me: deletes the LOGGED-IN user's own account.
// SECURITY: the account to delete is derived ONLY from req.user (the
// authenticated username), never from anything in the request body. This is
// deliberate - trusting a client-supplied UserId here would let any logged-in
// user delete someone else's account just by sending a different id.
const deleteMyRegistered = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        const deleted = await Registered.findOneAndDelete({ username: req.user }).exec();
        if (!deleted) return res.status(404).json({ message: 'Registered not found.' });
        res.json({ message: 'Account deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Delete failed.' });
    }
};

// Presence: the client calls this every ~15s while it's on an allowed page.
const presenceHeartbeat = async (req, res) => {
    try {
        await Registered.updateOne(
            { username: req.user },
            { $set: { isOnline: true, lastActiveAt: Date.now() } }
        ).exec();
        res.sendStatus(204);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Presence: the client calls this once, right as it leaves an allowed page.
const presenceOffline = async (req, res) => {
    try {
        await Registered.updateOne(
            { username: req.user },
            { $set: { isOnline: false, lastActiveAt: Date.now() } }
        ).exec();
        res.sendStatus(204);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Password reset: send reset code to registered user's email
const requestPasswordReset = async (req, res) => {
    const user = req.body.user || req.body.email;
    if (!user) return res.status(400).json({ message: 'user or email required in body.' });
    try {
        const reg = await Registered.findOne({ username: user }).exec();
        if (!reg) return res.status(404).json({ message: 'User not found.' });
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60 * 1000);
        const hashed = await bcrypt.hash(resetCode, 10);
        // Persist only the reset fields to avoid triggering full-document validation
        await Registered.updateOne({ _id: reg._id }, { $set: { resetVerificationCode: hashed, resetVerificationExpires: expires } }).exec();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: reg.username,
            subject: 'Password reset code',
            text: `Your password reset code is: ${resetCode}`,
            html: `<p>Your password reset code is: <strong>${resetCode}</strong></p><p>It expires in 15 minutes.</p>`
        };
        try {
            await transporter.sendMail(mailOptions);
            res.json({ message: 'Reset code sent.' });
        } catch (emailErr) {
            console.error('Email error:', emailErr);
            return res.status(500).json({ message: 'Failed to send email.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Two ways this is called from the frontend:
//  1) { user, code }              -> just checks the code is valid (doesn't
//                                     consume it), so the UI can move to the
//                                     "choose a new password" screen.
//  2) { user, code, newPassword } -> re-checks the code and, if still valid,
//                                     actually sets the new password and
//                                     consumes the code.
// The code is only ever cleared once a password has actually been set, so
// step 1 never burns the code step 2 needs.
const verifyResetCode = async (req, res) => {
    const user = req.body.user || req.body.email;
    const { code, newPassword } = req.body;
    if (!user || !code) return res.status(400).json({ message: 'user (or email) and code are required.' });
    try {
        const reg = await Registered.findOne({ username: user }).exec();
        if (!reg || !reg.resetVerificationCode || !reg.resetVerificationExpires) return res.status(404).json({ message: 'No reset request found.' });
        if (new Date() > new Date(reg.resetVerificationExpires)) return res.status(410).json({ message: 'Reset code expired.' });
        const ok = await bcrypt.compare(String(code), String(reg.resetVerificationCode));
        if (!ok) return res.status(401).json({ message: 'Invalid reset code.' });

        if (!newPassword) {
            return res.json({ message: 'Code verified.' });
        }

        if (String(newPassword).length > 64) {
            return res.status(400).json({ message: 'Password must be 64 characters or less.' });
        }
        if (!isStrongPassword(newPassword)) return res.status(400).json({ message: 'Password is not strong enough.' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await Registered.updateOne(
            { _id: reg._id },
            { $set: { password: hashed }, $unset: { resetVerificationCode: "", resetVerificationExpires: "" } }
        ).exec();
        res.json({ message: 'Password updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Safety net: if a client's heartbeat stops without ever sending the "offline"
// signal (crash, force-quit, lost network, killed tab), this flips isOnline
// back to false once its last heartbeat is older than PRESENCE_STALE_MS.
// lastActiveAt is deliberately left untouched here — it already holds the
// last real heartbeat time, which is the most accurate "last seen" we have.
setInterval(async () => {
    try {
        await Registered.updateMany(
            { isOnline: true, lastActiveAt: { $lt: Date.now() - PRESENCE_STALE_MS } },
            { $set: { isOnline: false } }
        ).exec();
    } catch (err) {
        console.error('Presence sweep failed:', err);
    }
}, PRESENCE_SWEEP_INTERVAL_MS);

module.exports = {
    existsRegistered,
    getAllRegistereds,
    createNewRegistered,
    updateRegistered,
    setAdminRole,
    deleteRegistered,
    getRegistered,
    getMyRegistered,
    deleteMyRegistered,
    presenceHeartbeat,
    presenceOffline,
    requestPasswordReset,
    verifyResetCode,
    employeeSanitization,
    handleValidationErrors
};
