const path= require('path');
const fsPromises= require('fs').promises;
const fs= require('fs');
const {v4:uuid}= require('uuid');
const {format}= require('date-fns');

const logEvents= async (message, logName)=>{
    const date= `${format(new Date(), 'yyyyMMdd\tHH:mm:ss')}`
    const logItem=`${date}\t${uuid()}\t${message}\n`;
    try{
      if (!fs.existsSync(path.join(__dirname, '..', 'logs'))){
        await fsPromises.mkdir(path.join(__dirname, '..', 'logs'));
      }
      await fsPromises.appendFile(path.join(__dirname, '..', 'logs', logName), logItem);
    }catch (err){
        console.log(err);
    }
}
const logger= (req, res, next)=>{
    logEvents(`${req.method}\t${req.headers.origin}\t${req.url}`, 'req.txt');
    next();
}
module.exports= {logger, logEvents};

