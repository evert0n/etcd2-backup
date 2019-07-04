#!/usr/bin/env node

var request = require('request');
var program = require('commander');
var fs = require('fs');
var throttled = require('throttled-promise');
var pkg = require('./package');

function checkFile(file) {
  if (!file) {
    console.error('Error missing --file option');
    process.exit(1);
  }
}

program
  .version(pkg.version)
  .option('-f, --file <file>', 'backup file')
  .option('-e, --etcd <etcd>', 'etcd url eg: https://0.0.0.0:4001')
  .option('-c, --concurrency <concurrency>', 'max parallel requests')

program
  .command('restore')
  .description('restore keys from backup file')
  .action(function(options) {

    var file = options.parent.file || undefined;
    var etcd = options.parent.etcd || 'http://0.0.0.0:4001';
    var concurrency = options.parent.concurrency || 5;

    checkFile(file);

    var promises = [];

    var configs = fs.readFileSync(file).toString();

    configs = JSON.parse(configs);

    configs.forEach(function(config) {

      var options = {
        rejectUnauthorized: false,
        uri: etcd + '/v2/keys' + config.key,
        method: 'put',
        form: { value: config.value }
      }

      promises.push(new throttled(function(resolve, reject) {
        console.log('Updating: ' + config.key);
        request(options, function(err, response, body) {
          if (err) {
            return reject(err);
          }
          return resolve(body);
        });
      }));

    });

    throttled.all(promises, concurrency)
      .then(function(results) {
        console.log('All configs restored')
      })
      .catch(function(err) {
        console.log(err);
        process.exit(1);
      });

  });

program
  .command('dump')
  .description('dump keys to backup file')
  .action(function(options) {

    var file = options.parent.file || undefined;
    var etcd = options.parent.etcd || 'http://0.0.0.0:4001';

    var options = {
      rejectUnauthorized: false,
      uri: etcd + '/v2/keys/?recursive=true',
      method: 'get',
      json:true
    }

    request(options, function(err, res, body) {

      if (err) {
        console.error(err);
        process.exit(1);
      }

      var configs = [];

      var extractFromNodes = function(nodes) {
        nodes.forEach(function(node) {
          if (node.hasOwnProperty('dir') && node.dir === true) {
            extractFromNodes(node.nodes);
          } else if (node.hasOwnProperty('value')) {
            configs.push({
              key: node.key,
              value: node.value
            });
          }
        });
      }

      extractFromNodes(body.node.nodes);

      configs = JSON.stringify(configs, null, 2);

      fs.writeFileSync(file, configs, null, function(err) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
      });

    });

  });

program.parse(process.argv);

if (!program.args.length) program.help();
