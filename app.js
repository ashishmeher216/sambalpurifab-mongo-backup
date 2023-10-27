const { spawn } = require('child_process');
const cron = require('node-cron');
const AWS = require('aws-sdk')
const AdmZip = require('adm-zip')
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
cron.schedule('*/60 * * * * *', () => backupMongoDB());  //every 60 seconds
// cron.schedule('*/2 * * * *', () => backupMongoDB());  //every 2 minutes
// cron.schedule('0 0 * * *', () => backupMongoDB());    //every midnight

const MONGO_URL = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASSWORD}@${process.env.MONGO_DB_HOST}/${process.env.MONGO_DB_DATABASE}?retryWrites=true&w=majority`;
const mongoUrl = MONGO_URL;
const bucketName = process.env.S3_BUCKET;
const s3bucket = new AWS.S3({
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
});
const s3StorageClass = process.env.S3_STORAGE_CLASS;
const folderPrefix = process.env.FOLDER_PREFIX;

function backupMongoDB() {
  const d = new Date();
  const fileName = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
  
  const folderName = `/tmp/${fileName}/`;
  let zipBuffer = null;

  const child = spawn('mongodump', [
    `--forceTableScan`,
    `--uri=${mongoUrl}`,
    `--out=${folderName}`
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
  child.on('exit', async (code, signal) => {
    if (code) console.log('Process exit with code:', code);
    else if (signal) console.log('Process killed with signal:', signal);
    else {
      try {
        const zip = new AdmZip()
        zip.addLocalFolder(folderName)
        zipBuffer = zip.toBuffer()
      } catch (err) {
        console.log('archive creation failed: ', err)
      }
      try {
        await s3bucket.upload({
          Bucket: bucketName,
          Key: `${folderPrefix}/${fileName}.zip`,
          Body: zipBuffer,
          ContentType: 'application/zip',
          ServerSideEncryption: 'AES256',
          StorageClass: s3StorageClass
        }).promise()
        console.log('Backup is successfull ✅');
      } catch (err) {
        console.log('upload to S3 failed: ', err)
      }
    }
  });
}