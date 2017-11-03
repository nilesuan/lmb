const Promise     = require('bluebird');
const fse         = require('fs-extra');
const AWS         = require('aws-sdk');

const base        = process.env.PWD + '/';

module.exports = {
  verify: json => {
    return new Promise((resolve, reject) => {

      // invoke with no input
      if(typeof json === 'undefined') return resolve('');

      // invoke with json string
      try { JSON.parse(json); return resolve(json); }
      catch (e) {

        // invoke with json file
        fse.ensureFile(json)
        .then(() => { return fse.readJson(json); })
        .then(data => { return resolve(data); })
        .catch(err => { return reject(err); });
      }
    });
  },
  run: (data, package) => {
    return new Promise((resolve, reject) => {

      AWS.config.update({region: package.lambda.region});
      const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

      let params = {
        FunctionName: package.name,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify(data),
        Qualifier: 'stage'
      };

      lambda.invoke(params, (err, data) => {
        if(err) return reject(err);
        else return resolve(data);
      });

    });
  },
  parse: data => {
    return new Promise((resolve, reject) => {
      let log = Buffer.from(data.LogResult, 'base64').toString('ascii').split('\n');
      log.forEach(line => console.log(line));
      return data.Payload;
    });
  }
};
