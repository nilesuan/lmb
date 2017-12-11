const Promise     = require('bluebird');
const AWS         = require('aws-sdk');
const fse         = require('fs-extra');
const clear    	  = require('clear-promise');

const base        = process.env.PWD + '/';

module.exports = {
  aliases: package => {
    return new Promise((resolve, reject) => {

      AWS.config.update({region: package.lambda.region});
      const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

      lambda.listAliases({ FunctionName: package.name }, (err, data) => {
            if(err) { return reject(err); }
            else {
            	clear();
            	Promise.map(data.Aliases, alias => {
            		console.log(alias.Name + ' >> ' + alias.FunctionVersion + ' = ' + alias.Description);
            	}).then(() => { return resolve(''); });
            }
      });
    });
  },
  versions: package => {
    return new Promise((resolve, reject) => {

      AWS.config.update({region: package.lambda.region});
      const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

      lambda.listVersionsByFunction({ FunctionName: package.name }, (err, data) => {
            if(err) { return reject(err); }
            else {
            	clear();
            	Promise.map(data.Versions, version => {
            		console.log(version.Version);
            	}).then(() => { return resolve(''); });
            }
      });
    });
  },
  check: package => {
    return new Promise((resolve, reject) => {

		AWS.config.update({region: package.lambda.region});
		const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

		let params = {
			FunctionName: package.name,
			Name: package.alias_name
		};

		lambda.getAlias(params, (err, data) => {
		    if(err) return resolve(false);
		    else return resolve(true);
		});

    });
  },
  delete: (package, exists) => {
    return new Promise((resolve, reject) => {

    	if(!exists) resolve(true);

		AWS.config.update({region: package.lambda.region});
		const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

		let params = {
			FunctionName: package.name,
			Name: package.alias_name
		};

		lambda.deleteAlias(params, (err, data) => {
		    if(err) return reject(err);
		    else return resolve(true);
		});

    });
  },
  create: package => {
    return new Promise((resolve, reject) => {

		AWS.config.update({region: package.lambda.region});
		const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

		let params = {
			FunctionName: package.name,
			FunctionVersion: package.alias_version,
			Name: package.alias_name,
			Description: package.alias_description
		};

		lambda.createAlias(params, (err, data) => {
		    if(err) return reject(err);
		    else return resolve(data);
		});

    });
  },
  tag: package => {
    return new Promise((resolve, reject) => {

		AWS.config.update({region: package.lambda.region});
		const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

		module.exports.check(package)
		.then(data => { return module.exports.delete(package, data); })
		.then(data => { return module.exports.create(package); })
		.then(data => {
        	clear();
	    	console.log(data.Name + ' >> ' + data.FunctionVersion + ' = ' + data.Description);
	    	return resolve('');
		});
    });
  },
  remove: package => {
    return new Promise((resolve, reject) => {

		AWS.config.update({region: package.lambda.region});
		const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

		module.exports.check(package)
		.then(data => { return module.exports.delete(package, data); })
		.then(data => { clear(); return resolve(''); });
    });
  }
};
