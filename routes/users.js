const express = require('express');
const router = express.Router();
const User = require('../model/User');// gets users from the db depending on the schema provided by the users.js in model folder
const rateLimit = require('../middleware/rateLimit');
// this is the file connected to users
router.use(rateLimit);
// Return simple array of usernames (optional)
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('username -_id').lean();// get the username of people in the db
        return res.json(users.map(u => u.username));
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// Check if a username exists (case-insensitive). Query: /users/exists?user=alice
router.get('/exists', async (req, res) => {// is used to get users like /users/exists?user=Abenet
    const { user } = req.query;// gets the one that says Abenet
    if (!user) return res.status(400).json({ message: 'user query required' });// if there is no username like Abenet, return 400
    try {
        const found = await User.findOne({ username: new RegExp(`^${user}$`, 'i') }).lean();// check if the username we entered matches the one in the db
        return res.json({ exists: !!found });// if the usernames match, it becomes exists:true. But if it does not exist, it becomes eixsts:false.
        //eg: if we say http://localhost:3500/users/exists?user=Abenet, then it will say in the response 
        /*
        {
  "exists": true
}
        */
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
