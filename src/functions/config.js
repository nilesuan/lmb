
const inquirer    = require('inquirer');
const Promise     = require('bluebird');
const fse         = require('fs-extra');
const os          = require('os');

module.exports = {
  ask: (configuration) => {
    return new Promise((resolve, reject) => {
      configuration = (configuration === null) ? {} : configuration;

      const env     = (typeof configuration.env === 'undefined')      ? 'dev'           : configuration.env;
      const runtime = (typeof configuration.runtime === 'undefined')  ? 'nodejs6.10'    : configuration.runtime;
      const role    = (typeof configuration.role === 'undefined')     ? ''              : configuration.role;
      const handler = (typeof configuration.handler === 'undefined')  ? 'index.handler' : configuration.handler;
      const timeout = (typeof configuration.timeout === 'undefined')  ? 3               : configuration.timeout;
      const memory  = (typeof configuration.memory === 'undefined')   ? 128             : configuration.memory;
      const region  = (typeof configuration.region === 'undefined')   ? 'us-east-1'     : configuration.region;
      const bucket  = (typeof configuration.bucket === 'undefined')   ? 'lambda-bucket' : configuration.bucket;

      const questions = [
        {
          name: 'env',
          type: 'list',
          message: 'Enviroment of the function:',
          default: env,
          choices: [
            'dev',
            'stage',
            'prod'
          ]
        },
        {
          name: 'runtime',
          type: 'list',
          message: 'Runtime of the function:',
          default: runtime,
          choices: [
            'nodejs',
            'nodejs4.3',
            'nodejs6.10',
            'java8',
            'python2.7',
            'python3.6',
            'dotnetcore1.0',
            'nodejs4.3-edge'
          ]
        },
        {
          name: 'role',
          type: 'input',
          message: 'AWS Lambda role used:',
          default: role,
          validate: value => {
            if (value.length) {
              return true;
            } else {
              return 'Please enter the Amazon Resource Name (ARN) of the IAM role that Lambda assumes when it executes your function to access any other Amazon Web Services (AWS) resources.';
            }
          }
        },
        {
          name: 'handler',
          type: 'input',
          message: 'Event handler name:',
          default: handler
        },
        {
          name: 'timeout',
          type: 'input',
          message: 'Function timeout in seconds:',
          default: timeout
        },
        {
          name: 'memory',
          type: 'input',
          message: 'Memory (mb) allocated to the function:',
          default: memory
        },
        {
          name: 'region',
          type: 'input',
          message: 'Regional endpoint:',
          default: region
        },
        {
          name: 'bucket',
          type: 'input',
          message: 'S3 Bucket to upload the code:',
          default: bucket
        }
      ];
      inquirer.prompt(questions).then(answers => resolve(answers));
    });
  },
  load: () => {
    return new Promise((resolve, reject) => {
      const config_file = os.homedir() + '/.lmb';
      fse.ensureFile(config_file)
      .then(() => { return fse.readJson(config_file, { throws: false }); })
      .then((configuration) => { resolve(configuration); })
      .catch(err => { reject(err); });
    });
  },
  save: (configuration) => {
    return new Promise((resolve, reject) => {
      const config_file = os.homedir() + '/.lmb';
      fse.ensureFile(config_file)
      .then(() => { return fse.writeJson(config_file, configuration); })
      .then(() => { return resolve(true); })
      .catch(err => { reject(err); });
    });
  }
};
