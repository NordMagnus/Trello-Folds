module.exports = function (grunt) {
  // grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-jest');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    manifest: grunt.file.readJSON('extension/manifest.json'),
    firefoxManifest: grunt.file.readJSON('extension/firefox-manifest.json'),
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
          { expand: true, cwd: 'dist/tmp/chrome/', src: ['**'], dest: '/' },
        ],
      },
      firefox: {
        options: {
          archive: 'dist/Trello-Folds-Firefox-<%= pkg.version %>.zip',
        },
        files: [
          { expand: true, cwd: 'dist/tmp/firefox/', src: ['**'], dest: '/' },
        ],
      },
    },
    copy: {
      chrome: {
        files: [
          {
            expand: true, cwd: 'extension/', src: ['**', '!firefox-manifest.json'],
            dest: 'dist/tmp/chrome',
          },
        ],
      },
      firefox: {
        files: [
          {
            expand: true, cwd: 'extension/', src: ['**', '!manifest.json'],
            dest: 'dist/tmp/firefox',
            rename: function (dest, src) {
              return `${dest}/${src.replace('firefox-manifest', 'manifest')}`;
            },
          },
        ],
      },
    },
  });

  grunt.registerTask('default', 'test');
  grunt.registerTask('test', 'Runs Jest tests', () => {
    grunt.task.run('jest:all');
  });
  grunt.registerTask('create-chrome-extension', 'copy:chrome');
  grunt.registerTask('create-firefox-extension', 'copy:firefox');
  grunt.registerTask('package-chrome', 'compress:main');
  grunt.registerTask('package-firefox', 'compress:firefox');
  grunt.registerTask('delete-tmp-folder', 'Deletes the temporary folder', () => {
    grunt.file.delete('dist/tmp');
  });
  grunt.registerTask('version-check',
      'Checks that package.json and manifest.json version matches', () => {
        const packageVer = grunt.config('pkg').version;
        const chromeVer = grunt.config('manifest').version;
        const firefoxVer = grunt.config('firefoxManifest').version;
        if (packageVer !== chromeVer) {
          grunt.log.error(`package.json [${packageVer}] and `
              + ` Chrome manifest.json [${chromeVer}] versions do not match`);
          return false;
        }
        if (packageVer !== firefoxVer) {
          grunt.log.error(`package.json [${packageVer}] and `
              + ` Firefox manifest.json [${firefoxVer}] versions do not match`);
          return false;
        }
        grunt.log.writeln(`Versions match: ${packageVer}`);
        return true;
      });
  grunt.registerTask('build', (browser) => {
    if (browser && !['chrome', 'firefox'].includes(browser)) {
      grunt.log.error('Build should be called with no args or "chrome" or "firefox"');
      return false;
    }

    grunt.task.run('version-check');
    const packageVersion = grunt.config('pkg').version;

    if (!browser || browser === 'chrome') {
      if (grunt.file.exists(`dist/Trello-Folds-${packageVersion}.zip`)) {
        grunt.fail.warn('File already exists');
      }
      // TODO Disabled because of Jest issue: https://github.com/ionic-team/stencil/issues/2168
      // grunt.option('reporter', 'progress');
      // grunt.task.run('test');
      grunt.task.run('create-chrome-extension');
      grunt.task.run('package-chrome');
    }

    if (!browser || browser === 'firefox') {
      if (grunt.file.exists(`dist/Trello-Folds-Firefox-${packageVersion}.zip`)) {
        grunt.fail.warn('File already exists');
      }
      // TODO Disabled because of Jest issue: https://github.com/ionic-team/stencil/issues/2168
      // grunt.option('reporter', 'progress');
      // grunt.task.run('test');
      grunt.task.run('create-firefox-extension');
      grunt.task.run('package-firefox');
    }

    grunt.task.run('delete-tmp-folder');
    return true;
  });
};
