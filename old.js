#!/usr/bin/env node

global.fs = require('fs');
global.util = require('util');

var async = require('async');
var aws = require('aws-sdk');
var fse = require('fs-extra');
var zip = require('zip-folder');
var readline = require('readline');
var program = require('commander');
var dockerlambda = require('docker-lambda');

var cwd = process.cwd() + '/';
var rootdir = __dirname + '/';
var templates = rootdir + 'templates/';

var debug = true;
global.api = null;
global.input = null;

if(fs.existsSync(rootdir + 'profiles/current.json')) {
	aws.config.loadFromPath(rootdir + 'profiles/current.json');
}


var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

var role, handler, memorysize, runtime, region, bucket, publish, timeout, key, invoke, lambda, s3, zipfile;
global.payload = 'input.json';

global.nlog = function(message, code) {
    var message = (typeof message === 'undefined') ? '' : message;
    var code = (typeof code === 'undefined') ? 0 : code;
    switch (code) {
        case 1:
            if(debug) console.log('[debug] ' + util.inspect(message, false, null));
            break; // var dump output
        case 2:
            console.log('[notice] ' + util.inspect(message, false, null));
            break; // notice output
        case 3:
            console.log('[warning] ' + util.inspect(message, false, null));
            break; // warning output
        case 4:
            console.log('[error] ' + util.inspect(message, false, null));
            die();
            break; // error output
        default:
            if(message instanceof Error) { console.log('[error] ' + util.inspect(message, false, null)); die(); }
            else { console.log(message); }
            break;
    }
};

var die = function(message, code) {
	var message = (typeof message === 'undefined') ? null : message;
	var code = (typeof code === 'undefined') ? 0 : code;
	if(code === 0) { if(message) { console.log(message); } process.exit(code); }
	else { console.log(util.inspect(message, false, null)); process.exit(code); }
};

var done = function(error, message) {
	if(error instanceof Error) die(error, 1);
	console.log(util.inspect(message, false, null));
};

var isan = function(str) { // is alpha numeric
  var code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
};

global.profile = (fs.existsSync(rootdir + 'profiles/current.json')) ? fse.readJSONSync(rootdir + 'profiles/current.json') : die('[error] cannot find current profile json');
global.package = (fs.existsSync('./package.json')) ? fse.readJSONSync('./package.json') : die('[error] cannot find package.json, please run npm init first');

var preclean = function(callback) {
	nlog('pre cleaning');
	fse.remove(zipfile, error => {
	  if(error) { callback(error, 'fse remove preclean function'); }
	  else { callback(null, { 'file': zipfile }); }
	});
};

var postclean = function(callback) {
	nlog('post cleaning');
	var params = { Bucket: bucket, Key: key };
	s3.deleteObject(params, function(error, data) {
		if(error) { callback(error, 's3 delete object postclean function'); }
		else {
	    	fse.remove(zipfile, error => {
			  if(error) { callback(error, 'fse remove postclean function'); }
			  else { callback(null, { 'bucket': bucket, 'key': key, 'file': zipfile }); }
			});
		}
	});
};

var zipfolder = function(callback) {
	nlog('zipping folder');
	zip(cwd, zipfile, function(error) {
		if(error) { callback(error, 'zip zipfolder function'); }
		else { callback(null, { 'path': zipfile }); }
	});
};

var s3upload = function(callback) {
	nlog('uploading to s3');
    while(!fs.existsSync(zipfile)) { require('deasync').sleep(1000); }
    var body = fs.readFileSync(zipfile);
    s3.upload({ Bucket: bucket, Key: key, Body: body, ACL: 'public-read' }, (error, data) => {
    	if(error) { callback(error, 's3 upload s3upload function'); }
		else { callback(null, { 'bucket': bucket, 'key': key, 'acl': 'public-read' }); }
    });
};

var lambdacreate = function(callback) {
	nlog('creating lambda function');
	var params = {
		Code: {
			S3Bucket: bucket,
			S3Key: key,
		},
		FunctionName: package.name,
		Description: package.description,
		Handler: handler,
		Role: role,
		Runtime: runtime,
		MemorySize: memorysize,
		Publish: publish,
		Timeout: timeout
	};

	lambda.createFunction(params, function(error, data) {
		if(error) { callback(error, 'lambda create lambdacreate function'); }
		else { callback(null, params, data); }
	});
};

var lambdaupdate = function (callback) {
	nlog('updating lambda function');
	var params = { FunctionName: package.name, Publish: publish, S3Bucket: bucket, S3Key: key };
	lambda.updateFunctionCode(params, function(error, data) {
		if(error) { callback(error, 'lambda update lambdaupdate function'); }
		else { callback(null, params, data); }
	});
};

var lambdainvoke = function(callback) {
	nlog('invoking lambda function');
	if(!invoke) { callback(null, null); }
	else {
        while(!fs.existsSync(cwd + global.payload)) { require('deasync').sleep(1000); }
        var payload = fs.readFileSync(cwd + global.payload);
    	var params = { FunctionName: package.name, InvocationType: 'RequestResponse', LogType: 'Tail', Payload: payload };
		lambda.invoke(params, function(error, data) {
			if(error) { callback(error, 'lambda invoke lambdainvoke function'); }
			callback(null, params, data);
		});
	}
};

var test = function(callback) {
	nlog('executing local test');
	var test = global.payload.split(/[/ ]+/).pop().split(/[. ]+/).shift();
	if(!fs.existsSync(cwd + global.payload)) callback(new Error('the file ' + global.payload + ' does not exist'));
	var payload = JSON.parse(fs.readFileSync(cwd + global.payload, 'utf8'));
	var index = require(cwd + 'index.js');
	global.event = payload;
	index.handler(payload, {}, function(error, data) {
	    if(error) { die(error, 1); }
	    else { die(JSON.stringify(data)); }
	});
};

var dock = function(callback) {
	nlog('executing docker test');
    if(!fs.existsSync(cwd + global.payload)) callback(new Error('the file ' + global.payload + ' does not exist'));
    var payload = JSON.parse(fs.readFileSync(cwd + global.payload, 'utf8'));
	var results = dockerlambda({event: payload});
	callback(null, results);
};

program
	.version(package.version)
	.description(package.description)
	.arguments('<command>')
	.option('-i, --invoke', 'Invokes the lambda function')
	.option('-p, --publish', 'The lambda publish flag')
	.option('-r, --region <region>', 'The aws region to use')
	.option('-b, --bucket <bucket>', 'The s3 bucket to upload to')
	.option('-k, --key <key>', 'The s3 key to upload')
	.option('-H, --handler <handler>', 'The lambda handler file to execute')
	.option('-R, --role <role>', 'The lambda role policy')
	.option('-E, --runtime <runtime>', 'The lambda runtime enviroment')
	.option('-M, --memorysize <memorysize>', 'The lambda maximum memory allocation')
	.option('-T, --timeout <timeout>', 'The lambda timeout setting');

program.on('--help', function() {
	console.log('  Commands:');
	console.log('');
	console.log('    $ lmb init         Creates a template index.js handler file');
	console.log('    $ lmb config       Configures the lambda cli and aws sdk');
	console.log('    $ lmb generate     Generates javascript and json files for a sub method');
	console.log('    $ lmb create       Creates a new lambda function online');
	console.log('    $ lmb update       Updates an existing lambda function online');
	console.log('    $ lmb test         Invokes an existing lambda function locally');
	console.log('');
	console.log('  Examples:');
	console.log('');
	console.log('    $ lmb generate');
	console.log('    $ lmb create -ip json/function_name.json');
	console.log('    $ lmb update -ip json/function_name.json');
	console.log('    $ lmb ltest -p json/function_name.json');
	console.log('    $ lmb dtest -p json/function_name.json');
	console.log('');
	console.log('  Notes:');
	console.log('');
	console.log('    lmb dtest requires docker to be installed');
	console.log('');
});

program.action(function(action, method) {

	global.input = (typeof process.argv[3] === 'undefined') ? null : process.argv[3];
	process.argv.forEach(function(arg) { // find any argument here and save it to a variable
		if(arg.indexOf('.json') !== -1) { global.payload = arg; }
	});

	role = (typeof program.role === 'undefined') ? global.profile.lambda.role : program.role;
	handler = (typeof program.handler === 'undefined') ? 'index.handler' : program.handler;
	memorysize = (typeof program.memorysize === 'undefined') ? 128 : program.memorysize;
	runtime = (typeof program.runtime === 'undefined') ? 'nodejs6.10' : program.runtime;
	region = (typeof program.region === 'undefined') ? global.profile.region : program.region;
	bucket = (typeof program.bucket === 'undefined') ? global.profile.lambda.bucket : program.bucket;
	publish = (typeof program.publish === 'undefined') ? false : program.publish;
	timeout = (typeof program.timeout === 'undefined') ? 60 : program.timeout;
	key = (typeof program.key === 'undefined') ? 'lambda.zip' : program.key;
	invoke = (typeof program.invoke === 'undefined') ? false : true;
	lambda = new aws.Lambda({region: region});
	s3 = new aws.S3();
	zipfile = cwd + key;

	switch(action) {
		case 'config':
			die('not yet implemented');
			break;
		case 'info':
			nlog(global.profile, 1);
			nlog(global.package, 1);
			die();
			break;
		case 'profile':
			var profile = process.argv[3];
			if(!fs.existsSync(rootdir + 'profiles/' + profile + '.json')) die('cannot find ' + profile + '.json, the profile does not exist');
			fse.removeSync(rootdir + 'profiles/current.json');
			try { fse.copySync(rootdir + 'profiles/' + profile + '.json', rootdir + 'profiles/current.json'); } // copy profile.json
			catch(error) {  console.log(util.inspect(error, false, null)); die(); }
			die();
			break;
		case 'init':
			try { fse.copySync(templates + 'index.js', cwd + 'index.js'); } // copy index.js
			catch(error) {  console.log(util.inspect(error, false, null)); die(); }
			fse.ensureDirSync(cwd + 'children') // create children dir
			fse.ensureDirSync(cwd + 'json') // create json dir
			package.lambda = {
				region: region,
				publish: publish,
				functions: []
			};
			fse.writeJsonSync('./package.json', package);
			die();
			break;
		case 'generate':
			if(!fs.existsSync(cwd + 'index.js')) die('cannot find index.js, please run lambda init first');
			fse.ensureDirSync(cwd + 'children') // make sure children dir exists
			fse.ensureDirSync(cwd + 'json') // make sure json dir exists
			if(!isan(global.input)) { nlog('the function name should be alpha numeric', 4); }
			if(package.lambda.functions.indexOf(global.input) !== -1) { nlog('function already exists', 4); } else {
				try { fse.copySync(templates + 'child.js', cwd + 'children/'+global.input+'.js'); }
				catch(error) { console.log(util.inspect(error, false, null)); die(); }
				fse.outputJsonSync(cwd + 'json/'+global.input+'.json', {'function': global.input});
				package.lambda.functions.push(global.input);
				fse.writeJsonSync(cwd + 'package.json', package);
				rl.close();
				die();
			}
			break;
		case 'remove':
			if(!isan(global.input)) { nlog('the function name should be alpha numeric', 4); }
			fse.removeSync(cwd + 'children/'+global.input+'.js');
			fse.removeSync(cwd + 'json/'+global.input+'.json');
			var index = package.lambda.functions.indexOf(global.input);
			if(index > -1) { package.lambda.functions.splice(index, 1); }
			fse.writeJsonSync(cwd + 'package.json', package);
			rl.close();
			die();
			break;
		case 'create':
			async.series({
			    preclean: preclean,
			    zipfolder: zipfolder,
			    s3upload: s3upload,
			    lambdacreate: lambdacreate,
			    postclean: postclean,
			    lambdainvoke: lambdainvoke
			}, function(error, results) {
			    if(error) {
			    	console.log('ERROR:');
			    	console.log(util.inspect(error, false, null));
				    console.log(util.inspect(results, false, null));
			    } else {
			    	console.log(util.inspect(results, false, null));
			    	if(results.lambdainvoke !== null) {
				    	var log = Buffer.from(results.lambdainvoke[1].LogResult, 'base64').toString('ascii').split('\n');
				    	for (var i = 0, len = log.length; i < len; i++) { console.log(log[i]); }
				    	console.log(results.lambdainvoke[1].Payload);
			    	}
			    }
			    die();
			});
			break;
		case 'update':
			async.series({
			    preclean: preclean,
			    zipfolder: zipfolder,
			    s3upload: s3upload,
			    lambdaupdate: lambdaupdate,
			    postclean: postclean,
			    lambdainvoke: lambdainvoke
			}, function(error, results) {
			    if(error) {
			    	console.log('ERROR:');
			    	console.log(util.inspect(error, false, null));
				    console.log(util.inspect(results, false, null));
			    } else {
			    	console.log(util.inspect(results, false, null));
			    	if(results.lambdainvoke !== null) {
				    	var log = Buffer.from(results.lambdainvoke[1].LogResult, 'base64').toString('ascii').split('\n');
				    	for (var i = 0, len = log.length; i < len; i++) { console.log(log[i]); }
				    	console.log(results.lambdainvoke[1].Payload);
			    	}
			    }
			    die();
			});
			break;
		case 'test':
			test(function(error, results) {
			    if(error) {
			    	console.log('ERROR:');
			    	console.log(util.inspect(error, false, null));
				    console.log(util.inspect(results, false, null));
					die();
			    } else { die(results); }
			});
			break;
		case 'dock':
			dock(function(error, results) {
			    if(error) {
			    	console.log('ERROR:');
			    	console.log(util.inspect(error, false, null));
				    console.log(util.inspect(results, false, null));
					die();
			    } else { die(results); }
			});
			break;
	}

})
.parse(process.argv);

process.on('unhandledRejection', (reason) => {
    console.log(reason);
    // application specific logging, throwing an error, or other logic here
});
process.on('uncaughtException', (exception) => {
  console.log(exception); // to see your exception details in the console
  // if you are on production, maybe you can send the exception details to your
  // email as well ?
});
