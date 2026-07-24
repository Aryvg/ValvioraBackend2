const User = require('../model/User');
const Registered = require('../model/Registered');
const bcrypt = require('bcrypt');
const transporter = require('../config/brevo');
const crypto = require('crypto');

const handleNewUser = async (req, res) => {
    const { user, pwd, firstname, lastname, age, country, confirm } = req.body;
    const profilePicture = req.file ? req.file.path : null;
    if (!user || !pwd || !profilePicture || !firstname || !lastname || !age || !country || !confirm) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Firstname and lastname length validation
    if (firstname.length > 50) {
        return res.status(400).json({ message: 'Firstname must be 50 characters or less.' });
    }
    if (lastname.length > 50) {
        return res.status(400).json({ message: 'Lastname must be 50 characters or less.' });
    }


    // Username and job length validation
    if (user.length > 50) {
        return res.status(400).json({ message: 'Username must be 50 characters or less.' });
    }
    

    // Age must be a number between 8 and 120
    const ageNum = Number(age);
    if (isNaN(ageNum)) {
        return res.status(400).json({ message: 'Age must be a number.' });
    }
    if (ageNum < 8 || ageNum > 120) {
        return res.status(400).json({ message: 'Age must be between 8 and 120.' });
    }

    // Password must be at least 8 characters and contain at least one letter and one number
    const pwdValid = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!pwdValid.test(pwd)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and contain at least one letter and one number.' });
    }

    // Confirm password validation
    if (pwd !== confirm) {
        return res.status(400).json({ message: 'Confirm password does not match password.' });
    }

    // Email format and domain validation (username must be an email)
    const emailRegex = /^[\w-.]+@gmail\.com$/;
    if (!emailRegex.test(user)) {
        return res.status(400).json({ message: 'Email must be a valid @gmail.com address.' });
    }

    // Country validation (using a simple list of countries)
    const validCountries = [
        'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
        'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
    ];
    if (!validCountries.includes(country)) {
        return res.status(400).json({ message: 'Country is not valid.' });
    }

    // ensure email isn't already fully registered
    const alreadyRegistered = await Registered.findOne({ username: user }).exec();
    if (alreadyRegistered) return res.status(409).json({ message: 'Email already registered.' });

    // check for existing pending registration (upsert case)
    const pending = await User.findOne({ username: user }).exec();

    try {
        // encrypt the password and confirm
        const hashedPwd = await bcrypt.hash(pwd, 10);
        const hashedConfirm = await bcrypt.hash(confirm, 10);

        // generate verification code and hash for storage
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

        // prepare mail options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user,
            subject: 'Your verification code',
            text: `Your verification code is: ${verificationCode}. It expires in 15 minutes.`,
            html: `<p>Your verification code is: <strong>${verificationCode}</strong></p><p>It expires in 15 minutes.</p>`
        };

        if (pending) {
            // Update existing pending registration (upsert semantics)
            const oldPending = pending.toObject();
            try {
                await User.updateOne({ _id: pending._id }, {
                    $set: {
                        password: hashedPwd,
                        profilePicture,
                        firstname,
                        lastname,
                        age,
                        country,
                        confirm: hashedConfirm,
                        verificationCode: hashedVerificationCode,
                        verificationExpires,
                        isVerified: false
                    }
                }).exec();

                // attempt to send email; if it fails, try to revert pending to previous state
                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`Sent verification code to ${user} (updated pending).`);
                    return res.status(200).json({ success: `Pending registration updated. Verification code sent to ${user}.` });
                } catch (emailErr) {
                    console.error('Error sending verification email for update:', emailErr);
                    try {
                        await User.replaceOne({ _id: pending._id }, oldPending).exec();
                    } catch (revertErr) {
                        console.error('Failed to revert pending user after email failure:', revertErr);
                    }
                    return res.status(500).json({ message: 'Failed to send verification email.' });
                }
            } catch (updateErr) {
                console.error('Failed to update pending registration:', updateErr);
                return res.status(500).json({ message: 'Failed to update pending registration.' });
            }
        } else {
            // create new pending registration
            try {
                const result = await User.create({
                    username: user,
                    password: hashedPwd,
                    profilePicture: profilePicture,
                    firstname: firstname,
                    lastname: lastname,
                    age: age,
                    country: country,
                    confirm: hashedConfirm,
                    verificationCode: hashedVerificationCode,
                    verificationExpires,
                    isVerified: false
                });

                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`Sent verification code to ${user}`);
                    return res.status(201).json({ success: `New user ${user} created! Verification code sent.` });
                } catch (emailErr) {
                    console.error('Error sending verification email:', emailErr);
                    // Cleanup: remove the created user since email failed
                    try { await User.deleteOne({ _id: result._id }); } catch (cleanupErr) { console.error('Cleanup failed:', cleanupErr); }
                    return res.status(500).json({ message: 'Failed to send verification email.' });
                }
            } catch (createErr) {
                console.error('Failed to create pending registration:', createErr);
                return res.status(500).json({ message: 'Failed to create pending registration.' });
            }
        }
    } catch (err) {
        res.status(500).json({ 'message': err.message });
    }
}

// Verify code and finalize registration
const jwt = require('jsonwebtoken');

const verifyCode = async (req, res) => {
    const { user, code } = req.body;
    if (!user || !code) return res.status(400).json({ message: 'user and code are required.' });

    try {
        const pending = await User.findOne({ username: user }).exec();
        if (!pending) return res.status(404).json({ message: 'No pending registration found.' });
        if (pending.isVerified) return res.status(400).json({ message: 'Already verified.' });

        if (!pending.verificationCode || !pending.verificationExpires) {
            return res.status(400).json({ message: 'Verification not available.' });
        }

        if (new Date() > new Date(pending.verificationExpires)) {
            try { await User.deleteOne({ _id: pending._id }); } catch (e) { /* ignore */ }
            return res.status(410).json({ message: 'Verification code expired.' });
        }

        const provided = String(code).trim();
        let match = false;
        try {
            match = await bcrypt.compare(provided, String(pending.verificationCode));
        } catch (compareErr) {
            console.error('Error during verification compare:', compareErr);
            // fallthrough to additional checks below
        }

        // Backwards-compatibility / safety: if the stored code is not a bcrypt hash
        // (e.g., legacy/plaintext), accept direct equality. This ensures users who
        // previously had plaintext codes can still verify after a failed attempt.
        if (!match) {
            try {
                if (String(pending.verificationCode) === provided) match = true;
            } catch (e) { /* ignore */ }
        }

        if (!match) {
            return res.status(401).json({ message: 'Invalid verification code.' });
        }

        const newRegistered = await Registered.create({
            UserId: crypto.randomUUID(),
            username: pending.username,
            password: pending.password,
            firstname: pending.firstname,
            lastname: pending.lastname,
            age: pending.age,
            country: pending.country,
            profilePicture: pending.profilePicture
        });

        try { await User.deleteOne({ _id: pending._id }); } catch (e) { console.error('Failed to remove pending user:', e); }

        // Create JWTs and set refresh cookie so the user is logged in immediately
        try {
            const roles = Object.values(newRegistered.roles).filter(Boolean);
            const accessToken = jwt.sign(
                { "UserInfo": { "username": newRegistered.username, "roles": roles } },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '15m' }
            );

            const refreshToken = jwt.sign(
                { "username": newRegistered.username },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: '1d' }
            );

            newRegistered.refreshToken = refreshToken;
            await newRegistered.save();

            res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: 24 * 60 * 60 * 1000 });

            return res.status(200).json({ message: 'Verified and registered.', roles, accessToken, redirect: '/Velviora.html' });
        } catch (tokenErr) {
            console.error('Error issuing tokens after verification:', tokenErr);
            return res.status(500).json({ message: 'Registered but failed to create session.' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error during verification.' });
    }
};

module.exports = { handleNewUser, verifyCode };