
const inquirer    = require('inquirer');
const Promise     = require('bluebird');
const fse         = require('fs-extra');
const archiver    = require('archiver');
const semver      = require('semver');
const fs          = require('fs');

const base        = process.env.PWD + '/';

module.exports = {
  ask: (package) => {
    return new Promise((resolve, reject) => {
      configuration = (package.lambda === null) ? {} : package.lambda;

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
          message: 'Runtime of the function:',
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
      inquirer.prompt(questions).then(answers => { package.lambda = answers; return resolve(package);});
    });
  },
  load: (configuration) => {
    return new Promise((resolve, reject) => {
      const package_file = base + 'package.json';
      fse.ensureFile(package_file)
      .then(() => { return fse.readJson(package_file, { throws: false }); })
      .then((package) => {
        configuration = (typeof configuration === 'undefined') ? {} : configuration;
        package.lambda = (typeof package.lambda === 'undefined') ? {} : package.lambda;
        package.lambda.env     = (typeof package.lambda.env === 'undefined')      ? configuration.env     : package.lambda.env;
        package.lambda.runtime = (typeof package.lambda.runtime === 'undefined')  ? configuration.runtime : package.lambda.runtime;
        package.lambda.role    = (typeof package.lambda.role === 'undefined')     ? configuration.role    : package.lambda.role;
        package.lambda.handler = (typeof package.lambda.handler === 'undefined')  ? configuration.handler : package.lambda.handler;
        package.lambda.timeout = (typeof package.lambda.timeout === 'undefined')  ? configuration.timeout : package.lambda.timeout;
        package.lambda.memory  = (typeof package.lambda.memory === 'undefined')   ? configuration.memory  : package.lambda.memory;
        package.lambda.region  = (typeof package.lambda.region === 'undefined')   ? configuration.region  : package.lambda.region;
        package.lambda.bucket  = (typeof package.lambda.bucket === 'undefined')   ? configuration.bucket  : package.lambda.bucket;
        return resolve(package);
      })
      .catch(err => { return reject(err); });
    });
  },
  save: (package) => {
    return new Promise((resolve, reject) => {
      const package_file = base + 'package.json';
      fse.ensureFile(package_file)
      .then(() => { return fse.writeJson(package_file, package, {spaces: '\t', EOL: '\n'}); })
      .then(() => { return resolve(true); })
      .catch(err => { return reject(err); });
    });
  },
  ensure: (package) => {
    return new Promise((resolve, reject) => {
      fse.ensureDir(base + '/src')
      .then(() => { return fse.ensureDir(base + '/tests') })
      .then(() => { return resolve(true); })
      .catch(err => { return reject(err); });
    });
  },
  verify: (package) => {
    return new Promise((resolve, reject) => {
      if(typeof package.lambda.env === 'undefined') return reject('The package does not have a lambda configuration. Please run "lmb init" first.');
      else return resolve(package);
    });
  },
  patch: (package, version) => {
    return new Promise((resolve, reject) => {
      if(semver.valid(package.version)) {
        package.version = semver.inc(package.version, version);
        return resolve(package);
      }
      else { return reject('The package version is invalid.'); }
    });
  },
  archive: (package, version) => {
    return new Promise((resolve, reject) => {
      fse.copy(base + 'package.json', base + 'src/package.json')
      .then(() => { return fse.copy(base + 'node_modules', base + 'src/node_modules'); })
      .then(() => {
        let output = fs.createWriteStream(base + 'lambda.zip');
        let archive = archiver('zip', {zlib: {level: 9}});

        output.on('close', () => { return resolve(true); });
        archive.on('error',err => { return reject(err); });
        archive.pipe(output);
        archive.directory('src/', false);
        archive.finalize();
      })
      .catch(err => { return reject(err); });
    });
  }
};
