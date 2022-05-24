const { spawn } = require('child_process');
const path = require('path');
const cron = require('node-cron');
const env = require('dotenv');

env.config({ path: __dirname + '/.env' });
/* 
Basic mongo dump and restore commands, they contain more options you can have a look at man page for both of them.
1. mongodump --db=db_name --archive=./db_namec.gzip --gzip
2. mongorestore --db=db_name --archive=./db_name.gzip --gzip

Using mongodump - without any args:
  will dump each and every db into a folder called "dump" in the directory from where it was executed.
Using mongorestore - without any args:
  will try to restore every database from "dump" folder in current directory, if "dump" folder does not exist then it will simply fail.
*/


// 1. Cron expression for every 5 seconds - */5 * * * * *
// 2. Cron expression for every night at 00:00 hours (0 0 * * * )
// Note: 2nd expression only contains 5 fields, since seconds is not necessary

// Scheduling the backup everyday at midnight (using node-cron)
// cron.schedule('0 0 * * *', () => backupMongoDB());    //every midnight
// cron.schedule('*/60 * * * * *', () => backupMongoDB());  //every 60 seconds
cron.schedule('*/2 * * * *', () => backupMongoDB());  //every 2 minutes


function backupMongoDB() {
  const d = new Date();
  const ARCHIVE_PATH = path.join(__dirname, '../../mongo-backups', `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`);
  const child = spawn('mongodump', [
    `--forceTableScan`,
    `--uri=mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASSWORD}@cluster0.ccvfl.mongodb.net/${process.env.MONGO_DB_DATABASE}`,
    `--out=${ARCHIVE_PATH}`,
    // '--gzip',
  ]);

  child.stdout.on('data', (data) => {
    console.log('stdout:\n', data);
  });
  child.stderr.on('data', (data) => {
    console.log('stderr:\n', Buffer.from(data).toString());
  });
  child.on('error', (error) => {
    console.log('error:\n', error);
  });
  child.on('exit', (code, signal) => {
    if (code) console.log('Process exit with code:', code);
    else if (signal) console.log('Process killed with signal:', signal);
    else console.log('Backup is successfull ✅');
  });
}