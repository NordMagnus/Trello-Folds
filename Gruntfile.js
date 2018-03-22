module.exports = function(grunt) {

    grunt.loadNpmTasks("grunt-mocha-test");
    grunt.loadNpmTasks("grunt-contrib-compress");

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        manifest: grunt.file.readJSON("extension/manifest.json"),
        mochaTest: {
            test: {
                options: {
                    reporter: "min",
                },
                src: ["test/**/*.tests.js"],
            },
        },
        compress: {
            main: {
                options: {
                    archive: "dist/Trello-Folds-<%= pkg.version %>.zip",
                },
                files: [
                    {expand: true, cwd: "extension/", src: ["**"], dest: "/"},
                ],
            },
        },
    });

    grunt.registerTask("test", "mochaTest");
    grunt.registerTask("zip", "compress");
    grunt.registerTask("version-check", "Checks that package.json and manifest.json version matches", function() {
        let packageVer = grunt.config("pkg").version;
        let manifestVer = grunt.config("manifest").version;
        if (packageVer !== manifestVer) {
            grunt.log.error(`package.json [${packageVer}] and manifest.json [${manifestVer}] versions do not match`);
            return false;
        }
        grunt.log.writeln(`Versions match: ${packageVer}`);
    });
    grunt.registerTask("build", ["version-check", "test", "zip"]);
};
