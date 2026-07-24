const express= require('express');
const router= express.Router();
const path= require('path');
router.get('/index.html', (req, res)=>{
    res.sendFile(path.join(__dirname, '..', 'views', 'subdir', 'index.html'));
});
router.get('/index', (req, res)=>{
    res.sendFile(path.join(__dirname, '..', 'views', 'subdir', 'index.html'));
});
router.get('/', (req, res)=>{
    res.sendFile(path.join(__dirname, '..', 'views', 'subdir', 'index.html'));
});

router.get('/test.html', (req, res)=>{
    res.sendFile(path.join(__dirname, '..', 'views', 'subdir', 'test.html'));
});
router.get('/test', (req, res)=>{
    res.sendFile(path.join(__dirname, '..', 'views', 'subdir', 'test.html'));
});
module.exports= router;
// The above is a page for subdirectory which works pretty much like root