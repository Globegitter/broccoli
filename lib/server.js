var Watcher = require('./watcher')
var middleware = require('./middleware')
var http = require('http')
var tinylr = require('tiny-lr')
var connect = require('connect')
var copyDereferenceSync = require('copy-dereference').sync

exports.watch = watch
exports.serve = serve

function initialize(builder, options) {
  this.options = options || {}
  this.watcher = options.watcher || new Watcher(builder, {verbose: true})
  this.app = connect().use(middleware(this.watcher))

  process.addListener('exit', function () {
    builder.cleanup()
  })

  // We register these so the 'exit' handler removing temp dirs is called
  process.on('SIGINT', function () {
    process.exit(1)
  })
  process.on('SIGTERM', function () {
    process.exit(1)
  })
}

function watch(builder, outputDir, options) {
  var that = this;
  initialize.call(this, builder, options)
  console.log('Watching files for changes:')

  this.watcher.on('change', function(results) {
    try {
      copyDereferenceSync(results.directory, outputDir, true)
    } catch (err) {
      throw err
    }
    console.log('Built into ' + outputDir + '/ - ' + Math.round(results.totalTime / 1e6) + ' ms @ ' + new Date().toString())
  })

  this.watcher.on('error', function(err) {
    console.log('Built with error:')
    // Should also show file and line/col if present; see cli.js
    console.log(err.stack)
    console.log('')
  })

}

function serve (builder, options) {
  initialize.call(this, builder, options)

  this.server = http.createServer(this.app)
  console.log('Starting server on http://' + options.host + ':' + options.port + '\n')

  var livereloadServer = new tinylr.Server
  livereloadServer.listen(this.options.liveReloadPort, function (err) {
    if(err) {
      throw err
    }
  })

  var liveReload = function() {
    // Chrome LiveReload doesn't seem to care about the specific files as long
    // as we pass something.
    livereloadServer.changed({body: {files: ['livereload_dummy']}})
  }

  this.watcher.on('change', function(results) {
    console.log('Built - ' + Math.round(results.totalTime / 1e6) + ' ms @ ' + new Date().toString())
    liveReload()
  })

  this.watcher.on('error', function(err) {
    console.log('Built with error:')
    // Should also show file and line/col if present; see cli.js
    if (err.file) {
      console.log('File: ' + err.file)
    }
    console.log(err.stack)
    console.log('')
    liveReload()
  })

  this.server.listen(parseInt(this.options.port, 10), this.options.host)
}