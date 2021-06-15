module.exports = function (grunt) {
  // grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-jest');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    manifest: grunt.file.readJSON('extension/manifest.json'),
    jest: {
      all: {
        options: {
          coverage: true,
          testPathPattern: /.*-test.js/,
        },
      },
    },
    compress: {
      main: {
        options: {
          archive: 'dist/Trello-Folds-<%= pkg.version %>.zip',
        },
        files: [
          { expand: true, cwd: 'extension/', src: ['**'], dest: '/' },
        ],
      },
    },
  });

  grunt.registerTask('default', 'test');
  grunt.registerTask('test', 'Runs Jest tests', () => {
    grunt.task.run('jest:all');
  });
  // grunt.registerTask('tdom', 'Run Mocha tests for tdom', () => {
  //   grunt.task.run('mochaTest:tdom');
  // });
  // grunt.registerTask('tfolds', 'Run Mocha tests for trello-folds', () => {
  //   grunt.task.run('mochaTest:tfolds');
  // });
  grunt.registerTask('zip', 'compress');
  grunt.registerTask('version-check',
      'Checks that package.json and manifest.json version matches', () => {
        const packageVer = grunt.config('pkg').version;
        const manifestVer = grunt.config('manifest').version;
        if (packageVer !== manifestVer) {
          grunt.log.error(`package.json [${packageVer}] and `
              + ` manifest.json [${manifestVer}] versions do not match`);
          return false;
        }
        grunt.log.writeln(`Versions match: ${packageVer}`);
        return true;
      });
  grunt.registerTask('build', () => {
    grunt.task.run('version-check');
    const packageVersion = grunt.config('pkg').version;
    if (grunt.file.exists(`dist/Trello-Folds-${packageVersion}.zip`)) {
      grunt.fail.warn('File already exists');
    }
    grunt.option('reporter', 'progress');
    grunt.task.run('test');
    grunt.task.run('zip');
  });
};
