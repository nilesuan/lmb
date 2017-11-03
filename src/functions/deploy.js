const Promise     = require('bluebird');
const fse         = require('fs-extra');
const AWS         = require('aws-sdk');
const fs          = require('fs');

const base        = process.env.PWD + '/';

module.exports = {
  clean: package => {
    return new Promise((resolve, reject) => {
      
      AWS.config.update({region: package.lambda.region});
      const s3 = new AWS.S3({apiVersion: '2006-03-01'});
      
      let params = { Bucket: package.lambda.bucket, Key: 'lambda.zip' };
      s3.deleteObject(params, (err, data) => {
        if(err) return reject(err);

        fse.remove(base + 'lambda.zip')
        .then(() => { return fse.remove(base + 'src/node_modules'); })
        .then(() => { return fse.remove(base + 'src/package.json'); })
        .then(() => { return resolve(true); })
        .catch(err => { return reject(err); });
      });

    });
  },
  upload: package => {
    return new Promise((resolve, reject) => {
      
      AWS.config.update({region: package.lambda.region});
      const s3 = new AWS.S3({apiVersion: '2006-03-01'});

      let body = fs.readFileSync(base + 'lambda.zip');
      let params = { Bucket: package.lambda.bucket, Key: 'lambda.zip', Body: body, ACL: 'public-read' };
      s3.upload(params, (err, data) => {
        if(err) return reject(err);
        else return resolve(true);
      });

      
    });
  },
  exists: package => {
    return new Promise((resolve, reject) => {
      
      AWS.config.update({region: package.lambda.region});
      const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

      lambda.getFunction({ FunctionName: package.name }, (err, data) => {
        if(err) package.lambda.exists = false;
        else package.lambda.exists = true;
        return resolve(package);
      });
    });
  },
  create: package => {
    return new Promise((resolve, reject) => {
      
      AWS.config.update({region: package.lambda.region});
      const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

      let params = {
        FunctionName: package.name,
        Description: package.description,
        Runtime: package.lambda.runtime,
        Role: package.lambda.role,
        Handler: package.lambda.handler,
        Timeout: package.lambda.timeout,
        MemorySize: package.lambda.memory,
        Publish: true,
        Code: {
          S3Bucket: package.lambda.bucket,
          S3Key: 'lambda.zip',
        }
      };

      lambda.createFunction(params, (err, data) => {
        if(err) return reject(err);
        else return resolve(data);
      });
    });
  },
  update: package => {
    return new Promise((resolve, reject) => {
      
      AWS.config.update({region: package.lambda.region});
      const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

      let params = {
        FunctionName: package.name,
        Description: package.description,
        Runtime: package.lambda.runtime,
        Role: package.lambda.role,
        Handler: package.lambda.handler,
        Timeout: package.lambda.timeout,
        MemorySize: package.lambda.memory
      };

      lambda.updateFunctionConfiguration(params, (err, data) => {
        if(err) return reject(err);
        else {
          let params = { FunctionName: package.name, Publish: true, S3Bucket: package.lambda.bucket, S3Key: 'lambda.zip' };
          lambda.updateFunctionCode(params, (err, data) => {
            if(err) return reject(err);
            else return resolve(data);
          });
        }
      });
    });
  }
};
