const express= require('express');
const router= express.Router();
const path= require('path');
router.get('/', (req, res)=>{
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});
router.get('/index', (req, res)=>{
    res.sendFile(path.join(__dirname, '..',  'views', 'index.html'));
});
router.get('/index', (req, res)=>{
    res.sendFile(path.join(__dirname, '..',  'views', 'index.html'));
});
router.get('/new-page.html', (req, res)=>{
    res.sendFile(path.join(__dirname,'..',  'views', 'new-page.html'));
});
router.get('/new-page', (req, res)=>{
    res.sendFile(path.join(__dirname, '..',  'views', 'new-page.html'));
});
router.get('/doc', (req, res)=>{
    res.sendFile(path.join(__dirname, '..',  'views', 'documentation.html'));
});
router.get('/old-page.html', (req, res)=>[
   router.redirect(301, '/new-page.html')
]);
router.get('/old-page', (req, res)=>[
   router.redirect(301, '/new-page.html')
]);

module.exports= router;

// Catch-all for 404 - must be last
// router.use((req, res) => {
//     res.status(404).sendFile(path.join(__dirname, '..', 'views', '404.html'));
// }); // This opens 404 page if we type something that does not exist like http://localhost:3500/bb