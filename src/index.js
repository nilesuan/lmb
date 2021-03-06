#!/usr/bin/env node

const CLI       = require('clui');
const chalk     = require('chalk');
const program   = require('commander');
const clear     = require('clear-promise');

const me        = require('./../package.json');

const Spinner   = CLI.Spinner;
const root      = __dirname + '/';
const config    = require(root + 'functions/config.js');
const package   = require(root + 'functions/package.js');
const deploy    = require(root + 'functions/deploy.js');
const invoke    = require(root + 'functions/invoke.js');
const aliases   = require(root + 'functions/aliases.js');
const test      = require(root + 'functions/test.js');

program
  .version(me.version);

program
  .command('config')
  .description('set global configuration for lambda functions')
  .action(() => {
    clear()
    .then(()     => { return config.load(); })
    .then(data   => { return config.ask(data); })
    .then(data   => { return config.save(data); })
    .then(()     => { return clear(); })
    .catch(err   => { console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb config');
    console.log();
  });

program
  .command('init')
  .description('initialize your function specifc configuration')
  .action(() => {
    clear()
    .then(()     => { return config.load(); })
    .then(data   => { return package.load(data); })
    .then(data   => { return package.ask(data); })
    .then(data   => { return package.save(data); })
    .then(()     => { return package.ensure(); })
    .then(()     => { return clear(); })
    .catch(err   => { console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb init');
    console.log();
  });

program
  .command('deploy [version] [alias]')
  .alias('update')
  .description('creates or updates the code and configuration for the specific lambda function')
  .action(version => {
    let status = new Spinner('deploying function');
    status.start();

    version = (typeof version === 'undefined') ? 'patch' : version;
    let hold = {};
    let exists = true;

    clear()
    .then(()     => { status.message('loading package configuration'); return package.load(); })
    .then(data   => { status.message('verifying package configuration'); return package.verify(data); })
    .then(data   => { status.message('patching version'); return package.patch(data, version); })
    .then(data   => { status.message('saving package configuration'); hold = data; return package.save(data); })
    .then(()     => { status.message('copying file dependencies'); return package.copy(hold); })
    .then(()     => { status.message('cleaning old files'); return deploy.clean(hold); })
    .then(()     => { status.message('archiving lambda function'); return package.archive(); })
    .then(()     => { status.message('uploading zip archive to s3'); return deploy.upload(hold); })
    .then(()     => { status.message('verifying remote lambda function'); return deploy.exists(hold); })
    .then(data   => {
      status.message('updating lambda code from s3 archive');
      hold = data;
      if(data.lambda.exists) { return deploy.update(data); }
      else { exists = false; return deploy.create(data); }
    })
    .then(()     => {
      if(!exists) {
        data = {
          name: hold.name,
          'alias_version': '$LATEST',
          'alias_name': 'dev',
          'alias_description': 'Developmen Version',
          'lambda': {
            'region': hold.lambda.region
          }
        };
        return aliases.create(data);
      }
      else { return true; }
    })
    .then(()     => { status.message('cleaning old files'); return deploy.clean(hold); })
    .then(()     => { status.stop(); return clear(); })
    .then(()     => { process.exit(); })
    .catch(err   => { status.stop(); console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb deploy');
    console.log('    $ lmb deploy patch');
    console.log('    $ lmb deploy minor stage');
    console.log('    $ lmb deploy major prod');
    console.log();
  });

program
  .command('invoke [json]')
  .alias('exec')
  .description('test the lambda function remotely on the aws lambda enviroment')
  .action((json, options) => {
    let status = new Spinner('deploying function');
    status.start();

    let hold = {};

    clear()
    .then(()     => { status.message('loading package configuration'); return package.load(); })
    .then(data   => { status.message('verifying package configuration'); return package.verify(data); })
    .then(data   => { status.message('verifying json payload'); hold = data; return invoke.verify(json); })
    .then(data   => { status.message('running remote lambda function'); return invoke.run(data, hold); })
    .then(data   => { status.stop(); hold = data; return clear(); })
    .then(()     => { return invoke.parse(hold); })
    .then(data   => { console.log(data); return true; })
    .then(()     => { process.exit(); })
    .catch(err   => { console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb invoke');
    console.log('    $ lmb invoke -l {"hello": "world"}');
    console.log('    $ lmb invoke -d input.json');
    console.log();
  });

program
  .command('test [json]')
  .description('test the lambda function locally before uploading it to aws')
  .option('-l, --local', 'test using local nodejs (default)')
  .option('-d, --docker', 'test using docker emulation')
  .action((json, options) => {
    let hold = {};
    let docker = (typeof options.docker === 'undefined') ? false : true;

    clear()
    .then(()     => { return package.load(); })
    .then(data   => { return package.verify(data); })
    .then(data   => { hold = data; return package.copy(data); })
    .then(data   => { return test.verify(json); })
    .then(data   => { return test.run(data, hold, docker); })
    .then(data   => { console.log(data); return true; })
    .then(()     => { process.exit(); })
    .catch(err   => { console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb test');
    console.log('    $ lmb test -l {"hello": "world"}');
    console.log('    $ lmb test -d input.json');
    console.log();
  });

program
  .command('alias [alias] [description]')
  .description('Set aliases to specific versions or list aliases of the function')
  .option('-t, --target', 'target version to attach the alias (defaults to $LATEST)')
  .option('-a, --aliases', 'list aliases of the function')
  .option('-v, --versions', 'list versions of the function')
  .option('-r, --remove', 'remove alias from the function')
  .action((alias, description, options) => {
    let status = new Spinner('deploying function');
    status.start();

    clear()
    .then(()     => { return package.load(); })
    .then(data   => { return package.verify(data); })
    .then(data   => {
      data.alias_name         = (typeof alias === 'undefined') ? 'dev' : alias;
      data.alias_version      = (typeof options.target === 'undefined') ? '$LATEST' : options.target;
      data.alias_description  = (typeof description === 'undefined') ? '' : description;
      if(!options.aliases && !options.versions && !options.remove) {
        status.message('creating ' + data.alias_name + ' alias for ' + data.name + ' function');
        return aliases.tag(data);
      } else if(options.aliases) {
        status.message('fetching function aliases');
        return aliases.aliases(data);
      } else if(options.versions) {
        status.message('fetching function versions');
        return aliases.versions(data);
      } else if(options.remove) {
        status.message('removing ' + data.alias_name + ' alias from ' + data.name + ' function');
        return aliases.remove(data);
      }
    })
    .then(data   => { console.log(data); return true; })
    .then(()     => { process.exit(); })
    .catch(err   => { console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb alias dev');
    console.log('    $ lmb alias test For testing');
    console.log('    $ lmb alias prod -v 11');
    console.log('    $ lmb alias -a');
    console.log('    $ lmb alias -r prod');
    console.log();
  });

program.parse(process.argv);
