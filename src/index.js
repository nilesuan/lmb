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

/*
const path      = require('path');

*/

program
  .version(me.version);

program
  .command('config')
  .description('set global configuration for lambda functions')
  .action(() => {
    clear()
    .then(()     => { return config.load(); })
    .then((data) => { return config.ask(data); })
    .then((data) => { return config.save(data); })
    .then(()     => { return clear(); })
    .catch((err) => { console.log(chalk.red(err)); process.exit(); });
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
    .then((data) => { return package.load(data); })
    .then((data) => { return package.ask(data); })
    .then((data) => { return package.save(data); })
    .then(()     => { return package.ensure(); })
    .then(()     => { return clear(); })
    .catch((err) => { console.log(chalk.red(err)); process.exit(); });
  })
  .on('--help',() => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ lmb init');
    console.log();
  });

program  
  .command('deploy [version] [env]')
  .description('creates or updates the code and configuration for the specific lambda function')
  .action((version) => {
    let status = new Spinner('deploying function');
    status.start();
    version = (typeof version === 'undefined') ? 'patch' : version;
    let hold = {};

    clear()
    .then(()     => { status.message('loading package configuration'); return package.load(); })
    .then((data) => { status.message('verifying package configuration'); return package.verify(data); })
    .then((data) => { status.message('patching version'); return package.patch(data, version); })
    .then((data) => { status.message('saving package configuration'); hold = data; return package.save(data); })
    .then(()     => { status.message('cleaning old files'); return deploy.clean(hold); })
    .then(()     => { status.message('archiving lambda function'); return package.archive(); })
    .then(()     => { status.message('uploading zip archive to s3'); return deploy.upload(hold); })
    .then(()     => { status.message('verifying remote lambda function'); return deploy.exists(hold); })
    .then((data) => {
      status.message('updating lambda code from s3 archive');
      hold = data;
      if(data.lambda.exists) return deploy.update(data);
      else return deploy.create(data);
    })
    .then(()     => { status.message('cleaning old files'); return deploy.clean(hold); })
    .then(()     => { status.stop(); return clear(); })
    .then(()     => { process.exit(); })
    .catch((err) => { status.stop(); console.log(chalk.red(err)); process.exit(); });
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
  .command('exec <cmd>')
  .alias('ex')
  .description('execute the given remote cmd')
  .option("-e, --exec_mode <mode>", "Which exec mode to use")
  .action(function(cmd, options){
    console.log('exec "%s" using %s mode', cmd, options.exec_mode);
  }).on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('    $ deploy exec sequential');
    console.log('    $ deploy exec async');
    console.log();
  });

program.parse(process.argv);