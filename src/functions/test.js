const dockerlmb   = require('docker-lambda');
const Promise     = require('bluebird');
const fse         = require('fs-extra');

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
  run: (data, package, docker) => {
    return new Promise((resolve, reject) => {

      if(!docker) { // local test
        let index = require(base + 'src/' + package.lambda.handler.split(".")[0] + '.js');
        let handler = package.lambda.handler.split(".")[1];
        index[handler](data, {}, (err, out) => {
            if(err) { reject(err); }
            else { resolve(JSON.stringify(out)); }
        });
      } else { // docker test
      /*
        let params = {
          event: data,
          taskDir: base + 'src/',
          dockerImage: 'lambci/lambda:' + package.lambda.runtime
        };
        console.log(data);
        console.log(package);
        console.log(params);

        return resolve(dockerlmb(params));
      */
        reject('not yet implemented');
      }



    });
  }
};
